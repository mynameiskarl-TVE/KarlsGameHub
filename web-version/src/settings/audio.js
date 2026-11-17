export const AUDIO_SETTINGS_KEY = "mini-arcade-hub.audio-settings.v1";
export const DEFAULT_AUDIO_SETTINGS = Object.freeze({
  musicEnabled: true,
  musicVolume: 35,
});

export function sanitizeAudioSettings(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  const volume = Number(value.musicVolume);
  return {
    musicEnabled:
      typeof value.musicEnabled === "boolean"
        ? value.musicEnabled
        : DEFAULT_AUDIO_SETTINGS.musicEnabled,
    musicVolume:
      Number.isFinite(volume)
        ? Math.max(0, Math.min(100, Math.round(volume)))
        : DEFAULT_AUDIO_SETTINGS.musicVolume,
  };
}

export function loadAudioSettings(storage) {
  if (!storage || typeof storage.getItem !== "function") {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }

  try {
    const raw = storage.getItem(AUDIO_SETTINGS_KEY);
    return raw ? sanitizeAudioSettings(JSON.parse(raw)) : { ...DEFAULT_AUDIO_SETTINGS };
  } catch {
    return { ...DEFAULT_AUDIO_SETTINGS };
  }
}

export function saveAudioSettings(settings, storage) {
  if (!storage || typeof storage.setItem !== "function") return false;

  try {
    storage.setItem(
      AUDIO_SETTINGS_KEY,
      JSON.stringify(sanitizeAudioSettings(settings))
    );
    return true;
  } catch {
    return false;
  }
}
