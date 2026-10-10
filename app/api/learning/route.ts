import { getD1 } from "../../../db";
import { trialAccess, trialIpHash } from "../../trial-ip";

export const dynamic = "force-dynamic";

const MODEL_VERSION = "v4-dual-road-feedback";
const MINIMUM_SAMPLES = 12;
const SIDES = new Set(["B", "P"]);
const OUTCOMES = new Set(["B", "P", "T"]);
const SIGNALS = new Set(["ask", "composite", "basic"]);
const STRENGTHS = new Set(["watch", "low", "medium"]);

function reply(value: object, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

async function snapshotHash(signature: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(signature));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function learningProfile() {
  const database = getD1();
  const rows = await database.prepare(`
    SELECT feature_bucket,
      COUNT(*) AS total,
      SUM(CASE WHEN actual_outcome IN ('B', 'P') THEN 1 ELSE 0 END) AS decisive,
      SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct,
      SUM(CASE WHEN actual_outcome = 'T' THEN 1 ELSE 0 END) AS ties
    FROM (
      SELECT feature_bucket, actual_outcome, is_correct
      FROM learning_predictions
      WHERE model_version = ? AND feedback_at IS NOT NULL
      ORDER BY feedback_at DESC
      LIMIT 5000
    )
    GROUP BY feature_bucket
  `).bind(MODEL_VERSION).all<{ feature_bucket: string; total: number; decisive: number; correct: number; ties: number }>();
  const buckets: Record<string, { decisive: number; correct: number; ties: number }> = {};
  let totalFeedback = 0;
  let decisiveFeedback = 0;
  for (const row of rows.results ?? []) {
    buckets[row.feature_bucket] = { decisive: Number(row.decisive), correct: Number(row.correct), ties: Number(row.ties) };
    totalFeedback += Number(row.total);
    decisiveFeedback += Number(row.decisive);
  }
  return { modelVersion: MODEL_VERSION, minimumSamples: MINIMUM_SAMPLES, totalFeedback, decisiveFeedback, buckets };
}

export async function GET() {
  try {
    return reply({ profile: await learningProfile() });
  } catch (error) {
    console.error("Unable to read learning profile", error);
    return reply({ error: "目前無法讀取學習資料" }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const access = await trialAccess(request.headers);
    if (access.disabled) return reply({ error: "此 IP 的免費試用已被停用" }, 403);
    const body = await request.json() as Record<string, unknown>;
    const predictedSide = typeof body.predictedSide === "string" ? body.predictedSide : "";
    const signalClass = typeof body.signalClass === "string" ? body.signalClass : "";
    const strengthClass = typeof body.strengthClass === "string" ? body.strengthClass : "";
    const captureMode = body.captureMode === "live" ? "live" : body.captureMode === "upload" ? "upload" : "";
    const bankerTenths = Number(body.bankerTenths);
    const signature = typeof body.signature === "string" ? body.signature : "";
    if (!SIDES.has(predictedSide) || !SIGNALS.has(signalClass) || !STRENGTHS.has(strengthClass)
      || !captureMode || !Number.isInteger(bankerTenths) || bankerTenths < 450 || bankerTenths > 550
      || !signature || signature.length > 1200 || !/^[BPTRUG|]+$/.test(signature)) {
      return reply({ error: "學習資料格式不正確" }, 400);
    }
    const featureBucket = `${signalClass}:${strengthClass}:${predictedSide}`;
    const database = getD1();
    const recent = await database.prepare("SELECT COUNT(*) AS count FROM learning_predictions WHERE trial_ip_hash = ? AND created_at >= datetime('now', '-1 minute')")
      .bind(access.ipHash).first<{ count: number }>();
    if ((recent?.count ?? 0) >= 30) return reply({ error: "學習紀錄送出過於頻繁，請稍後再試" }, 429);
    const id = crypto.randomUUID();
    await database.prepare(`INSERT INTO learning_predictions
      (id, trial_ip_hash, model_version, capture_mode, predicted_side, banker_tenths, signal_class, strength_class, feature_bucket, snapshot_hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, access.ipHash, MODEL_VERSION, captureMode, predictedSide, bankerTenths, signalClass, strengthClass, featureBucket, await snapshotHash(signature))
      .run();
    return reply({ prediction: { id, predictedSide, featureBucket } }, 201);
  } catch (error) {
    console.error("Unable to create learning prediction", error);
    return reply({ error: "目前無法建立學習紀錄" }, 503);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const predictionId = typeof body.predictionId === "string" ? body.predictionId : "";
    const actualOutcome = typeof body.actualOutcome === "string" ? body.actualOutcome : "";
    if (!/^[0-9a-f-]{36}$/i.test(predictionId) || !OUTCOMES.has(actualOutcome)) return reply({ error: "開牌資料格式不正確" }, 400);
    const ipHash = await trialIpHash(request.headers);
    const database = getD1();
    const prediction = await database.prepare("SELECT predicted_side FROM learning_predictions WHERE id = ? AND trial_ip_hash = ? AND model_version = ? LIMIT 1")
      .bind(predictionId, ipHash, MODEL_VERSION).first<{ predicted_side: "B" | "P" }>();
    if (!prediction) return reply({ error: "找不到本局學習紀錄" }, 404);
    const correct = actualOutcome === "T" ? null : Number(prediction.predicted_side === actualOutcome);
    const feedbackSource = body.detected === true ? "automatic" : "manual";
    const result = await database.prepare(`UPDATE learning_predictions
      SET actual_outcome = ?, is_correct = ?, feedback_source = ?, feedback_at = CURRENT_TIMESTAMP
      WHERE id = ? AND trial_ip_hash = ? AND actual_outcome IS NULL`)
      .bind(actualOutcome, correct, feedbackSource, predictionId, ipHash).run();
    if (!result.meta.changes) return reply({ error: "本局結果已經記錄" }, 409);
    return reply({ correct: correct === null ? null : Boolean(correct), profile: await learningProfile() });
  } catch (error) {
    console.error("Unable to save learning feedback", error);
    return reply({ error: "目前無法儲存開牌結果" }, 503);
  }
}
