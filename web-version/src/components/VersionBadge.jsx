import React from "react";
import {
  APP_VERSION,
  UPDATE_REQUIRED_EVENT,
  displayVersion,
  fetchClientRequirements,
  isOlderThan,
  updateRequiredText,
} from "../lib/version.js";

/** Small "v10.10" pill shown next to the MINI ARCADE title on every screen. */
export function VersionBadge() {
  const shown = displayVersion();
  return (
    <span className="version-badge" title={`Mini Arcade Hub version ${shown}`}>
      v{shown}
    </span>
  );
}

/**
 * Red bar shown when this copy is too old for online play: either the server's minimum (checked
 * on load) is newer than this version, or the server just refused a request with "update required".
 * Guest play keeps working; the server is what actually blocks online data.
 */
export function UpdateRequiredBanner({ client }) {
  const [message, setMessage] = React.useState("");

  React.useEffect(() => {
    function onRefused(event) {
      setMessage(updateRequiredText({ message: event?.detail?.message }));
    }
    window.addEventListener(UPDATE_REQUIRED_EVENT, onRefused);
    return () => window.removeEventListener(UPDATE_REQUIRED_EVENT, onRefused);
  }, []);

  React.useEffect(() => {
    if (!client) return undefined;
    let cancelled = false;
    fetchClientRequirements(client)
      .then((requirements) => {
        if (!cancelled && requirements && isOlderThan(APP_VERSION, requirements.minVersion)) {
          setMessage(updateRequiredText(requirements));
        }
      })
      .catch(() => {
        // Offline or the version-gate script is not installed: say nothing, the server still decides.
      });
    return () => {
      cancelled = true;
    };
  }, [client]);

  if (!message) return null;
  return (
    <div className="update-banner" role="alert">
      <strong>Update required.</strong> {message}
    </div>
  );
}
