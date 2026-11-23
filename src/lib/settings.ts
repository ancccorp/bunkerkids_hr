import "server-only";
import { cache } from "react";
import { all, run } from "./db";

export { DEFAULT_SETTINGS } from "./settings-defaults";
import { DEFAULT_SETTINGS } from "./settings-defaults";

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
export type Settings = Record<SettingKey, string>;

/** 요청 단위로 캐시 */
export const getSettings = cache(async (): Promise<Settings> => {
  const rows = await all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const out = { ...DEFAULT_SETTINGS } as Settings;
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
});

export async function setSetting(key: SettingKey, value: string) {
  await run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", key, value);
}
