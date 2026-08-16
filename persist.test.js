import { describe, expect, it, vi } from "vitest";
import {
  loadBest,
  loadSettings,
  saveBest,
  saveSettings,
} from "./persist.js";

describe("alleyclaim persistence", () => {
  it("loads a valid best score and degrades offline", async () => {
    const online = vi.fn(async () => ({ ok: true, text: async () => "27" }));
    const offline = vi.fn(async () => {
      throw new Error("offline");
    });
    await expect(loadBest(online)).resolves.toBe(27);
    await expect(loadBest(offline)).resolves.toBe(0);
  });

  it("writes only a new best to the required KV key", async () => {
    const fetcher = vi.fn(async () => ({ ok: true }));
    await expect(saveBest(8, 12, fetcher)).resolves.toBe(12);
    expect(fetcher).not.toHaveBeenCalled();
    await expect(saveBest(15, 12, fetcher)).resolves.toBe(15);
    expect(fetcher).toHaveBeenCalledWith("/api/kv/alleyclaim:best", {
      method: "PUT",
      body: "15",
    });
  });

  it("persists mute settings and keeps defaults when unavailable", async () => {
    const online = vi.fn(async (url, options) =>
      options
        ? { ok: true }
        : { ok: true, json: async () => ({ muted: true }) },
    );
    await expect(loadSettings(online)).resolves.toEqual({ muted: true });
    await saveSettings({ muted: false }, online);
    expect(online).toHaveBeenLastCalledWith("/api/kv/alleyclaim:settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ muted: false }),
    });
  });
});
