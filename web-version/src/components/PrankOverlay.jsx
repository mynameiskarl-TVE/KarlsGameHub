import React from "react";

const PRANK_PRESENTATIONS = {
  confetti: {
    tag: "CELEBRATION",
    label: "A little celebration",
    title: "Confetti time!",
    message: "A surprise burst of confetti just arrived. Your game is still right where you left it.",
  },
  reality_glitch: {
    tag: "VISUAL EFFECT",
    label: "Visual surprise",
    title: "Did the screen just blink?",
    message: "Just a tiny arcade visual glitch. Everything is okay and your progress is unchanged.",
  },
  nickname_swap: {
    tag: "NAME MIX-UP",
    label: "Temporary name mix-up",
    title: "Name mix-up!",
    message: "For this pop-up only, your nickname has been temporarily mixed up. Your real profile name has not changed.",
  },
  fake_announcement: {
    tag: "ANNOUNCEMENT",
    label: "Arcade announcement",
    title: "Official Mini Arcade announcement",
    message: "The management has announced that all ducks are now honorary arcade mascots. Carry on!",
  },
  duck_invasion: {
    tag: "DUCKS",
    label: "Duck visitor",
    title: "Duck invasion!",
    message: "A few friendly ducks have waddled onto the screen. They will be gone shortly.",
  },
  fortune: {
    tag: "FORTUNE",
    label: "A tiny fortune",
    title: "Your Mini Arcade fortune",
    message: "Small steps add up. Your next great idea might start with one little experiment.",
  },
  jumpscare: {
    tag: "SPOOKY",
    label: "Mild spooky surprise",
    title: "BOO!",
    message: "Just a harmless Mini Arcade ghost popping in to say hello.",
  },
};

export default function PrankOverlay({ event, onDismiss }) {
  const presentation = PRANK_PRESENTATIONS[event?.eventType];
  const dismissRef = React.useRef(onDismiss);

  React.useEffect(() => {
    dismissRef.current = onDismiss;
  }, [onDismiss]);

  React.useEffect(() => {
    if (!presentation) {
      dismissRef.current?.(event?.eventId);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      dismissRef.current?.(event.eventId);
    }, 12_000);

    return () => window.clearTimeout(timer);
  }, [event?.eventId, presentation]);

  if (!presentation) return null;

  const confetti = event.eventType === "confetti";
  const ducks = event.eventType === "duck_invasion";
  const glitch = event.eventType === "reality_glitch";
  const spooky = event.eventType === "jumpscare";

  return (
    <div className={`prank-overlay ${glitch ? "prank-overlay-glitch" : ""} ${spooky ? "prank-overlay-spooky" : ""}`}>
      {confetti && (
        <div className="prank-confetti" aria-hidden="true">
          {Array.from({ length: 34 }, (_, index) => (
            <span
              key={index}
              style={{
                left: `${(index * 37) % 100}%`,
                animationDelay: `${(index % 9) * -0.55}s`,
                animationDuration: `${4 + (index % 5)}s`,
              }}
            />
          ))}
        </div>
      )}

      {ducks && (
        <div className="prank-ducks" aria-hidden="true">
          {Array.from({ length: 6 }, (_, index) => (
            <span
              key={index}
              style={{
                left: `${(index * 17) % 94}%`,
                animationDelay: `${index * -0.8}s`,
              }}
            >
              DUCK
            </span>
          ))}
        </div>
      )}

      <div className="prank-popup" role="status" aria-live="polite">
        <div className="prank-popup-tag" aria-hidden="true">{presentation.tag}</div>
        <span className="eyebrow">{presentation.label}</span>
        <h2>{presentation.title}</h2>
        <p>{presentation.message}</p>
        <button type="button" onClick={() => onDismiss(event.eventId)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
