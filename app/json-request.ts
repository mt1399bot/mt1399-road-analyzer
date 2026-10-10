export type TrialUsage = {
  used?: number;
  usedToday?: number;
  limit?: number;
  remaining?: number;
  disabled?: boolean;
  recorded?: boolean;
  error?: string;
};

export async function requestJson<T>(url: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  const response = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
    credentials: "same-origin",
  });
  if (response.redirected || !response.headers.get("Content-Type")?.includes("application/json")) {
    throw new Error("試用服務沒有回傳正確資料，請重新開啟測試站後再試；重試不會重複扣除同一次分析的額度");
  }
  let value: T;
  try {
    value = await response.json() as T;
  } catch {
    throw new Error("試用服務回應不完整，請稍後重試");
  }
  return { response, value };
}

export async function consumeTrialUsage(requestId: string) {
  try {
    return await requestJson<TrialUsage>("/analyze/api/trial/use", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId }),
    });
  } catch (cause) {
    // The request may have succeeded even if its response was lost or replaced.
    // Recover only a server receipt for this exact request; never infer from count.
    try {
      const recovered = await requestJson<TrialUsage>(`/analyze/api/trial/status?requestId=${encodeURIComponent(requestId)}`);
      if (recovered.response.ok && recovered.value.recorded) return recovered;
    } catch {
      // Keep the original error and the same request ID for the next attempt.
    }
    throw cause;
  }
}
