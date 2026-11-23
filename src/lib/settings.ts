import "server-only";
import { all, run } from "./db";

export { DEFAULT_SETTINGS } from "./settings-defaults";
import { DEFAULT_SETTINGS } from "./settings-defaults";

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
export type Settings = Record<SettingKey, string>;

export function getSettings(): Settings {
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const out = { ...DEFAULT_SETTINGS } as Settings;
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
}

export function setSetting(key: SettingKey, value: string) {
  run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", key, value);
}
