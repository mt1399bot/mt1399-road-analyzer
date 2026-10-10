import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { Miniflare } from "miniflare";

const mf = new Miniflare({
  scriptPath: resolve("dist/server/index.js"),
  modules: true,
  modulesRules: [{ type: "ESModule", include: ["**/*.js"] }],
  // The installed local workerd binary supports dates through 2026-05-22.
  compatibilityDate: "2026-05-22",
  compatibilityFlags: ["nodejs_compat"],
  d1Databases: { DB: "trial-api-validation" },
  bindings: { MEMBER_SESSION_SECRET: "test-only-trial-key" },
});

try {
  const database = await mf.getD1Database("DB");
  for (const filename of (await readdir("drizzle")).filter((name) => name.endsWith(".sql")).sort()) {
    const sql = await readFile(resolve("drizzle", filename), "utf8");
    for (const statement of sql.split("--> statement-breakpoint")) {
      if (statement.trim()) await database.prepare(statement).run();
    }
  }
  const headers = { "CF-Connecting-IP": "198.51.100.10", "Accept": "application/json", "Content-Type": "application/json" };
  const call = async (path, init = {}) => {
    const response = await mf.dispatchFetch(`https://test.local/analyze${path}`, { ...init, headers: { ...headers, ...init.headers } });
    if (!response.headers.get("Content-Type")?.includes("application/json")) {
      throw new Error(`${path}: status=${response.status}, location=${response.headers.get("Location")}, body=${(await response.text()).slice(0, 200)}`);
    }
    return { status: response.status, value: await response.json() };
  };
  const consume = (requestId) => call("/api/trial/use", { method: "POST", body: JSON.stringify({ requestId }) });
  assert.equal((await call("/api/trial/status")).value.remaining, 20);
  await database.prepare("UPDATE trial_usage SET count = 5, first_used_at = '2026-10-09 00:00:00', updated_at = CURRENT_TIMESTAMP").run();
  assert.equal((await call("/api/trial/status")).value.remaining, 20, "One-time Preview restoration must return existing IPs to 20 rounds");
  const emptyLearning = await call("/api/learning");
  assert.equal(emptyLearning.status, 200);
  assert.equal(emptyLearning.value.profile.totalFeedback, 0);
  const learning = await call("/api/learning", { method: "POST", body: JSON.stringify({
    predictedSide: "B", bankerTenths: 507, signalClass: "composite", strengthClass: "low", captureMode: "upload", signature: "BPBP|RURU",
  }) });
  assert.equal(learning.status, 201);
  const predictionId = learning.value.prediction.id;
  const feedback = await call("/api/learning", { method: "PATCH", body: JSON.stringify({ predictionId, actualOutcome: "B", detected: true }) });
  assert.equal(feedback.status, 200);
  assert.equal(feedback.value.correct, true);
  assert.equal(feedback.value.profile.totalFeedback, 1);
  assert.equal((await database.prepare("SELECT feedback_source FROM learning_predictions WHERE id = ?").bind(predictionId).first()).feedback_source, "automatic");
  assert.equal((await call("/api/learning", { method: "PATCH", body: JSON.stringify({ predictionId, actualOutcome: "P" }) })).status, 409);
  assert.equal((await call("/api/learning", { method: "PATCH", headers: { "CF-Connecting-IP": "198.51.100.11" }, body: JSON.stringify({ predictionId, actualOutcome: "P" }) })).status, 404);
  const firstId = randomUUID();
  assert.equal((await consume(firstId)).value.used, 1);
  assert.equal((await consume(firstId)).value.used, 1, "Retry must not consume twice");
  assert.equal((await call(`/api/trial/status?requestId=${firstId}`)).value.recorded, true);
  assert.equal((await call(`/api/trial/status?requestId=${randomUUID()}`)).value.recorded, false);
  assert.equal((await call("/api/trial/use", { method: "POST", body: "{}" })).status, 400);
  assert.equal((await call("/api/trial/status")).value.used, 1, "Invalid input must not consume");
  const concurrentId = randomUUID();
  await Promise.all(Array.from({ length: 5 }, () => consume(concurrentId)));
  assert.equal((await call("/api/trial/status")).value.used, 2, "Concurrent duplicate retries must consume once");
  for (let index = 2; index < 20; index++) assert.equal((await consume(randomUUID())).status, 200);
  assert.equal((await consume(randomUUID())).status, 429);
  assert.equal((await consume(firstId)).status, 200, "Receipt recovery must work after reaching the limit");
  assert.equal((await call("/api/trial/status", { headers: { "CF-Connecting-IP": "198.51.100.11" } })).value.remaining, 20);
  for (const path of ["/admin", "/login", "/member", "/api/admin", "/api/member"]) {
    const response = await mf.dispatchFetch(`https://test.local/analyze${path}`, { headers });
    assert.equal(response.status, 404, path);
  }
  console.log("Worker API integration passed: learning feedback, JSON, durable receipts, retries, concurrency, quota, IP isolation, retired routes.");
} finally {
  await mf.dispose();
}
