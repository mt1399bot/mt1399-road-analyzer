import { TRIAL_LIMIT, trialAccess } from "../../../trial-ip";
import { getD1 } from "../../../../db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const access = await trialAccess(request.headers);
    const requestId = new URL(request.url).searchParams.get("requestId");
    const receipt = requestId ? await getD1().prepare("SELECT recorded FROM trial_request_receipts WHERE request_id = ? AND ip_hash = ?")
      .bind(requestId, access.ipHash).first<{ recorded: number }>() : null;
    return Response.json({
      used: access.used,
      limit: TRIAL_LIMIT,
      remaining: Math.max(0, TRIAL_LIMIT - access.used),
      disabled: access.disabled,
      ...(requestId ? { recorded: receipt?.recorded === 1 } : {}),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "目前無法讀取免費試用局數" }, { status: 503 });
  }
}
