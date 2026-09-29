// No SDK dependency. Retry transient failures once within one overall deadline.
export async function requestDecision(endpoint: string, apiKey: string, body: unknown, timeoutMs: number): Promise<any> {
  const serialized = JSON.stringify(body);
  // A conservative byte ceiling, not a tokenizer or an API context-limit claim.
  if (Buffer.byteLength(serialized) > 28000) throw new Error("request-budget");
  const controller = new AbortController();
  const timeout = Number.isFinite(timeoutMs) ? Math.max(1, Math.min(timeoutMs, 30000)) : 15000;
  const deadline = Date.now() + timeout;
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await fetch(endpoint, {
        method: "POST", redirect: "error", signal: controller.signal,
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: serialized,
      });
      if (response.ok) return await response.json();
      if (attempt === 0 && [429, 529, 502, 503].includes(response.status)) {
        const header = response.headers.get("retry-after");
        const seconds = header === null ? NaN : Number(header);
        const delay = header === null ? 300 : Number.isFinite(seconds) ? Math.max(0, seconds * 1000)
          : Math.max(0, Date.parse(header) - Date.now());
        await response.body?.cancel();
        if (!Number.isFinite(delay) || delay >= deadline - Date.now()) throw new Error(`http-${response.status}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      await response.body?.cancel();
      throw new Error(`http-${response.status}`);
    }
    throw new Error("unavailable");
  } catch (error) {
    if (controller.signal.aborted) throw new Error("timeout");
    throw error;
  } finally { clearTimeout(timer); }
}
