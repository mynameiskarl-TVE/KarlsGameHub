import React from "react";
import {
  loadAudioSettings,
  saveAudioSettings,
} from "../settings/audio.js";

const MUSIC_SOURCE =
  "https://raw.githubusercontent.com/mynameiskarl-TVE/KarlsGameHub/main/mini_arcade_hub_v10_9_online_pranks/BeepBox-Song.mp3";

function readSettings() {
  try {
    return loadAudioSettings(window.localStorage);
  } catch {
    return loadAudioSettings(null);
  }
}

export default function AudioSettingsPanel() {
  const [settings, setSettings] = React.useState(readSettings);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [status, setStatus] = React.useState(
    "Music is enabled. Press Start music when you're ready."
  );
  const [storageStatus, setStorageStatus] = React.useState("");

  const audioRef = React.useRef(null);

  React.useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    audio.volume = settings.musicVolume / 100;
    audio.loop = true;

    if (!settings.musicEnabled) {
      audio.pause();
      setStatus("Background music is disabled.");
    } else if (!isPlaying) {
      setStatus("Music is enabled. Press Start music when you're ready.");
    }
  }, [settings.musicEnabled, settings.musicVolume]);

  React.useEffect(() => {
    let saved = false;
    try {
      saved = saveAudioSettings(settings, window.localStorage);
    } catch {
      saved = false;
    }
    setStorageStatus(
      saved
        ? "Your audio preferences are saved on this device."
        : "Browser storage is unavailable. Audio preferences may reset after reload."
    );
  }, [settings]);

  async function startMusic() {
    const audio = audioRef.current;
    if (!audio) return;

    if (!settings.musicEnabled) {
      setSettings((current) => ({ ...current, musicEnabled: true }));
    }

    audio.volume = settings.musicVolume / 100;

    try {
      await audio.play();
      setIsPlaying(true);
      setStatus("Background music is playing.");
    } catch {
      setIsPlaying(false);
      setStatus("The browser could not start playback. Check your connection and press Start music again.");
    }
  }

  function pauseMusic() {
    audioRef.current?.pause();
    setIsPlaying(false);
    setStatus("Background music is paused.");
  }

  function changeEnabled(event) {
    const enabled = event.target.checked;
    setSettings((current) => ({ ...current, musicEnabled: enabled }));

    if (!enabled) {
      audioRef.current?.pause();
      setIsPlaying(false);
      setStatus("Background music is disabled.");
    } else {
      setStatus("Music is enabled. Press Start music when you're ready.");
    }
  }

  function changeVolume(event) {
    const musicVolume = Number(event.target.value);
    setSettings((current) => ({ ...current, musicVolume }));
    if (audioRef.current) {
      audioRef.current.volume = musicVolume / 100;
    }
  }

  function handleAudioError() {
    setIsPlaying(false);
    setStatus("The music file could not be loaded. Check your internet connection and try again.");
  }

  return (
    <section className="audio-settings-page" aria-labelledby="audio-settings-title">
      <div className="audio-settings-heading">
        <span className="eyebrow">PREFERENCES</span>
        <h1 id="audio-settings-title">Settings</h1>
        <p className="muted">Adjust the background music to suit your device.</p>
      </div>

      <div className="audio-settings-card">
        <div className="audio-settings-row">
          <div>
            <strong>Background music</strong>
            <p>Loop the Mini Arcade theme while you play.</p>
          </div>
          <label className="audio-toggle">
            <input
              type="checkbox"
              checked={settings.musicEnabled}
              onChange={changeEnabled}
              aria-label="Enable background music"
            />
            <span>{settings.musicEnabled ? "Enabled" : "Disabled"}</span>
          </label>
        </div>

        <div className="audio-volume-section">
          <div className="audio-volume-heading">
            <label htmlFor="music-volume">Music volume</label>
            <strong>{settings.musicVolume}%</strong>
          </div>
          <input
            id="music-volume"
            className="audio-volume-slider"
            type="range"
            min="0"
            max="100"
            step="1"
            value={settings.musicVolume}
            onChange={changeVolume}
            disabled={!settings.musicEnabled}
          />
          <div className="audio-volume-labels"><span>0%</span><span>100%</span></div>
        </div>

        <div className="audio-actions">
          <button
            className="audio-primary-button"
            type="button"
            onClick={startMusic}
            disabled={isPlaying}
          >
            {isPlaying ? "Music playing" : "Start music"}
          </button>
          <button
            className="audio-secondary-button"
            type="button"
            onClick={pauseMusic}
            disabled={!isPlaying}
          >
            Pause music
          </button>
        </div>

        <p className="audio-status" role="status" aria-live="polite">{status}</p>
        <p className="audio-storage-status">{storageStatus}</p>
      </div>

      <audio
        ref={audioRef}
        src={MUSIC_SOURCE}
        preload="none"
        loop
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={handleAudioError}
      />
    </section>
  );
}
