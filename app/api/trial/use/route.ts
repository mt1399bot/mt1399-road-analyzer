import { getD1 } from "../../../../db";
import { TRIAL_LIMIT, trialIdentity } from "../../../trial-ip";

export const dynamic = "force-dynamic";

function reply(value: object, status = 200) {
  return Response.json(value, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}

export async function POST(request: Request) {
  let requestId: string;
  try {
    const body = await request.json() as { requestId?: unknown };
    if (typeof body.requestId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(body.requestId)) {
      return reply({ error: "請重新整理測試站，載入最新版本後再試" }, 400);
    }
    requestId = body.requestId;
  } catch {
    return reply({ error: "請重新整理測試站，載入最新版本後再試" }, 400);
  }
  try {
    const identity = await trialIdentity(request.headers);
    const database = getD1();
    // D1 batches are transactional. A durable receipt limits each request to one
    // increment and lets the browser recover when a successful reply is lost.
    const results = await database.batch([
      database.prepare(`INSERT INTO trial_usage (ip_hash, ip_address, device, count, status)
        VALUES (?, ?, ?, 0, 'active')
        ON CONFLICT(ip_hash) DO UPDATE SET ip_address = excluded.ip_address, device = excluded.device`)
        .bind(identity.ipHash, identity.ipAddress, identity.device),
      database.prepare(`INSERT INTO trial_request_receipts (request_id, ip_hash, recorded)
        SELECT ?, ?, 0 FROM trial_usage WHERE ip_hash = ? AND status = 'active' AND count < ?
        ON CONFLICT(request_id) DO NOTHING`)
        .bind(requestId, identity.ipHash, identity.ipHash, TRIAL_LIMIT),
      database.prepare(`UPDATE trial_usage SET count = count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE ip_hash = ? AND EXISTS (
          SELECT 1 FROM trial_request_receipts WHERE request_id = ? AND ip_hash = ? AND recorded = 0
        )`).bind(identity.ipHash, requestId, identity.ipHash),
      database.prepare("UPDATE trial_request_receipts SET recorded = 1 WHERE request_id = ? AND ip_hash = ? AND recorded = 0")
        .bind(requestId, identity.ipHash),
      database.prepare(`SELECT count FROM trial_usage WHERE ip_hash = ? AND EXISTS (
        SELECT 1 FROM trial_request_receipts WHERE request_id = ? AND ip_hash = ? AND recorded = 1
      )`).bind(identity.ipHash, requestId, identity.ipHash),
    ]);
    const result = results[4].results?.[0] as { count: number } | undefined;

    if (!result) {
      const current = await database.prepare("SELECT count, status FROM trial_usage WHERE ip_hash = ? LIMIT 1")
        .bind(identity.ipHash)
        .first<{ count: number; status: "active" | "disabled" }>();
      if (current?.status === "disabled") {
        return reply({ error: "此 IP 的免費試用已被管理員停用", disabled: true }, 403);
      }
      return reply({ error: "免費試用次數已用完，請聯繫官方客服", limit: TRIAL_LIMIT }, 429);
    }
    return reply({ used: result.count, limit: TRIAL_LIMIT, remaining: Math.max(0, TRIAL_LIMIT - result.count), recorded: true });
  } catch (error) {
    console.error("Unable to record trial usage", error);
    return reply({ error: "目前無法記錄免費試用局數" }, 503);
  }
}
