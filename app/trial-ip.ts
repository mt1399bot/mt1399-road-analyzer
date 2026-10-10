import "server-only";
import { env } from "cloudflare:workers";
import { getD1 } from "../db";
import { deviceLabel } from "./device-label";

export const TRIAL_LIMIT = 20;
// One-time Preview quota restoration. Existing learning rows keep their stable IP hash.
const TRIAL_USAGE_RESET_AT = "2026-10-10 05:10:00";

type HeaderReader = { get(name: string): string | null };

function clientIp(headers: HeaderReader) {
  const direct = headers.get("cf-connecting-ip") || headers.get("x-real-ip");
  if (direct) return direct.trim();
  const forwarded = headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || null;
}

function secret() {
  const value = (env as unknown as { MEMBER_SESSION_SECRET?: string }).MEMBER_SESSION_SECRET;
  if (!value) throw new Error("Trial usage protection is not configured");
  return value;
}

function hex(bytes: ArrayBuffer) {
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function trialIpHash(headers: HeaderReader) {
  const ip = clientIp(headers);
  if (!ip) throw new Error("Unable to identify connection address");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret()), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`trial:${ip}`)));
}

export async function trialIdentity(headers: HeaderReader) {
  const ipAddress = clientIp(headers);
  if (!ipAddress) throw new Error("Unable to identify connection address");
  return {
    ipHash: await trialIpHash(headers),
    ipAddress,
    device: deviceLabel(headers.get("user-agent") || ""),
  };
}

export async function trialAccess(headers: HeaderReader) {
  const identity = await trialIdentity(headers);
  const database = getD1();
  await database.prepare(`
    INSERT INTO trial_usage (ip_hash, ip_address, device, count, status, first_used_at, updated_at)
    VALUES (?, ?, ?, 0, 'active', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT(ip_hash) DO UPDATE SET
      ip_address = excluded.ip_address,
      device = excluded.device,
      count = CASE WHEN first_used_at < ? THEN 0 ELSE count END,
      first_used_at = CASE WHEN first_used_at < ? THEN CURRENT_TIMESTAMP ELSE first_used_at END,
      updated_at = CURRENT_TIMESTAMP
  `).bind(identity.ipHash, identity.ipAddress, identity.device, TRIAL_USAGE_RESET_AT, TRIAL_USAGE_RESET_AT).run();
  const row = await database.prepare("SELECT count, status FROM trial_usage WHERE ip_hash = ? LIMIT 1")
    .bind(identity.ipHash)
    .first<{ count: number; status: "active" | "disabled" }>();
  return { used: row?.count ?? 0, disabled: row?.status === "disabled", ipHash: identity.ipHash };
}
