const BEST_URL = "/api/kv/alleyclaim:best";
const SETTINGS_URL = "/api/kv/alleyclaim:settings";

export async function loadBest(fetcher = fetch) {
  try {
    const response = await fetcher(BEST_URL);
    if (!response.ok) return 0;
    const value = Number(await response.text());
    return Number.isFinite(value) && value >= 0 ? value : 0;
  } catch {
    return 0;
  }
}

export async function saveBest(score, currentBest, fetcher = fetch) {
  const nextBest = Math.max(score, currentBest);
  if (nextBest <= currentBest) return currentBest;
  try {
    await fetcher(BEST_URL, { method: "PUT", body: String(nextBest) });
  } catch {
    // Static and offline previews remain fully playable.
  }
  return nextBest;
}

export async function loadSettings(fetcher = fetch) {
  try {
    const response = await fetcher(SETTINGS_URL);
    if (!response.ok) return { muted: false };
    const settings = await response.json();
    return { muted: settings?.muted === true };
  } catch {
    return { muted: false };
  }
}

export async function saveSettings(settings, fetcher = fetch) {
  const safeSettings = { muted: settings?.muted === true };
  try {
    await fetcher(SETTINGS_URL, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(safeSettings),
    });
  } catch {
    // Settings are optional when the host KV API is unavailable.
  }
  return safeSettings;
}
