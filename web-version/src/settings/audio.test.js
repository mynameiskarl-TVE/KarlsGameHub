import test from "node:test";
import assert from "node:assert/strict";
import {
  AUDIO_SETTINGS_KEY,
  DEFAULT_AUDIO_SETTINGS,
  sanitizeAudioSettings,
  loadAudioSettings,
  saveAudioSettings,
} from "./audio.js";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    values,
  };
}

test("uses the same default music settings as the Python game", () => {
  assert.deepEqual(DEFAULT_AUDIO_SETTINGS, { musicEnabled: true, musicVolume: 35 });
  assert.deepEqual(loadAudioSettings(memoryStorage()), DEFAULT_AUDIO_SETTINGS);
});

test("saves and restores audio preferences from device storage", () => {
  const storage = memoryStorage();
  assert.equal(saveAudioSettings({ musicEnabled: false, musicVolume: 62 }, storage), true);
  assert.ok(storage.getItem(AUDIO_SETTINGS_KEY));
  assert.deepEqual(loadAudioSettings(storage), { musicEnabled: false, musicVolume: 62 });
});

test("clamps the volume to the 0–100 range and rejects invalid types", () => {
  assert.deepEqual(sanitizeAudioSettings({ musicEnabled: true, musicVolume: 140 }), {
    musicEnabled: true,
    musicVolume: 100,
  });
  assert.deepEqual(sanitizeAudioSettings({ musicEnabled: "yes", musicVolume: -10 }), {
    musicEnabled: true,
    musicVolume: 0,
  });
  assert.equal(sanitizeAudioSettings({ musicVolume: "not-a-number" }).musicVolume, 35);
});

test("corrupt settings and unavailable storage safely fall back", () => {
  const storage = memoryStorage({ [AUDIO_SETTINGS_KEY]: "{bad json" });
  assert.deepEqual(loadAudioSettings(storage), DEFAULT_AUDIO_SETTINGS);
  assert.equal(loadAudioSettings(null).musicEnabled, true);
  assert.equal(saveAudioSettings(DEFAULT_AUDIO_SETTINGS, null), false);
});
