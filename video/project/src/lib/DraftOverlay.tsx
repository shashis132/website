import React from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontStack } from "../brand/tokens";

// Burned into every draft so review notes can say "scene s03 at 0:32".
export const DraftOverlay: React.FC<{ sceneId?: string; label?: string }> = ({ sceneId, label }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const u = width / 1920;
  const total = Math.floor(frame / fps);
  const tc = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}.${String(frame % fps).padStart(2, "0")}`;
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: 24 * u,
          right: 32 * u,
          fontFamily: fontStack.mono,
          fontSize: 26 * u,
          color: colors.paper,
          background: "rgba(11,15,26,0.72)",
          padding: `${8 * u}px ${14 * u}px`,
          borderRadius: 6 * u,
          letterSpacing: "0.04em",
        }}
      >
        DRAFT {label ? `· ${label} ` : ""}· {sceneId ?? "—"} · {tc}
      </div>
    </AbsoluteFill>
  );
};
