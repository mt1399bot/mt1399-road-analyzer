import assert from "node:assert/strict";
import { consumeTrialUsage, requestJson } from "../app/json-request";

const originalFetch = globalThis.fetch;
try {
  globalThis.fetch = async (_url, init) => {
    assert.equal(new Headers(init?.headers).get("Accept"), "application/json");
    assert.equal(init?.cache, "no-store");
    return new Response("<!DOCTYPE html><html>Sign in</html>", { headers: { "Content-Type": "text/html" } });
  };
  await assert.rejects(requestJson("/api"), /請重新開啟測試站/);

  const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    calls.push(String(url));
    if (init?.method === "POST") return new Response("<!DOCTYPE html>", { headers: { "Content-Type": "text/html" } });
    return Response.json({ used: 1, limit: 20, remaining: 19, recorded: true });
  };
  const recovered = await consumeTrialUsage("test-request");
  assert.equal(recovered.value.used, 1);
  assert.equal(calls.length, 2);
  assert.match(calls[1], /requestId=test-request/);

  globalThis.fetch = async (_url, init) => init?.method === "POST"
    ? new Response("<!DOCTYPE html>", { headers: { "Content-Type": "text/html" } })
    : Response.json({ used: 1, recorded: false });
  await assert.rejects(consumeTrialUsage("unrecorded-request"), /請重新開啟測試站/);

  globalThis.fetch = async () => new Response("{", { headers: { "Content-Type": "application/json" } });
  await assert.rejects(requestJson("/api"), /回應不完整/);
  console.log("JSON response regression passed: HTML, malformed JSON, receipt recovery, unrelated receipt rejection.");
} finally {
  globalThis.fetch = originalFetch;
}
