import React from "react";
import { AbsoluteFill, Audio, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { colors, fontStack, gradients } from "../brand/tokens";
import { DraftOverlay } from "../lib/DraftOverlay";

// A five-second brand sting: proves fonts, palette, motion and (optionally)
// a voice line and music bed all work end to end. Props are overridable with
// `--props '{"draft":true}'` on the command line.
export type BrandTestProps = {
  headline: string;
  caption: string;
  rows: { label: string; value: number; unit?: string }[];
  vo?: string; // path under public/, e.g. "test/vo/hello.mp3"
  music?: string; // path under public/
  draft?: boolean;
};

export const brandTestDefaults: BrandTestProps = {
  headline: "Your books, closed by Friday.",
  caption: "GeniusCFO · pipeline test",
  rows: [
    { label: "Invoices matched", value: 1284 },
    { label: "GST reconciled", value: 100, unit: "%" },
    { label: "Cash runway", value: 14, unit: " months" },
  ],
  draft: false,
};

const fmt = (n: number) => n.toLocaleString("en-IN");

export const BrandTest: React.FC<BrandTestProps> = ({ headline, caption, rows, vo, music, draft }) => {
  const frame = useCurrentFrame();
  const { fps, width, durationInFrames } = useVideoConfig();
  const u = width / 1920; // every size below is designed at 1080p and scaled

  const cardIn = spring({ frame, fps, config: { damping: 18, stiffness: 120 } });
  const headIn = spring({ frame: frame - 6, fps, config: { damping: 16, stiffness: 100 } });
  const fadeOut = interpolate(frame, [durationInFrames - 15, durationInFrames - 1], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ background: gradients.hero, fontFamily: fontStack.body, color: colors.ink }}>
      <AbsoluteFill style={{ opacity: fadeOut }}>
        <div
          style={{
            position: "absolute",
            top: 64 * u,
            left: 96 * u,
            fontFamily: fontStack.display,
            fontWeight: 600,
            fontSize: 44 * u,
            letterSpacing: "-0.01em",
            color: colors.ink,
          }}
        >
          Genius<span style={{ color: colors.emeraldText }}>CFO</span>
        </div>

        <div
          style={{
            position: "absolute",
            left: 96 * u,
            top: 300 * u,
            width: 760 * u,
            fontFamily: fontStack.display,
            fontWeight: 600,
            fontSize: 96 * u,
            lineHeight: 1.02,
            letterSpacing: "-0.015em",
            opacity: headIn,
            transform: `translateY(${(1 - headIn) * 30 * u}px)`,
          }}
        >
          {headline}
        </div>

        <div
          style={{
            position: "absolute",
            right: 96 * u,
            top: 240 * u,
            width: 820 * u,
            background: colors.paper,
            borderRadius: 12 * u,
            boxShadow: `0 ${24 * u}px ${64 * u}px rgba(11,15,26,0.14)`,
            padding: `${36 * u}px ${44 * u}px`,
            opacity: cardIn,
            transform: `translateY(${(1 - cardIn) * 60 * u}px)`,
          }}
        >
          <div
            style={{
              fontSize: 20 * u,
              fontWeight: 600,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: colors.ink3,
              marginBottom: 18 * u,
            }}
          >
            This week
          </div>
          {rows.map((r, i) => {
            const rowIn = spring({ frame: frame - 18 - i * 10, fps, config: { damping: 20, stiffness: 140 } });
            const count = Math.round(r.value * interpolate(rowIn, [0, 1], [0, 1]));
            return (
              <div
                key={r.label}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  padding: `${18 * u}px 0`,
                  borderTop: `${1 * u}px solid ${colors.hairline}`,
                  opacity: rowIn,
                  fontSize: 30 * u,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 14 * u }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: 14 * u,
                      height: 14 * u,
                      borderRadius: 999,
                      background: colors.emerald,
                      transform: `scale(${rowIn})`,
                    }}
                  />
                  {r.label}
                </span>
                <span style={{ fontFamily: fontStack.mono, fontVariantNumeric: "tabular-nums", fontWeight: 500 }}>
                  {fmt(count)}
                  {r.unit ?? ""}
                </span>
              </div>
            );
          })}
        </div>

        <div
          style={{
            position: "absolute",
            left: 96 * u,
            bottom: 64 * u,
            fontFamily: fontStack.mono,
            fontSize: 22 * u,
            color: colors.ink3,
            letterSpacing: "0.04em",
          }}
        >
          {caption}
        </div>
      </AbsoluteFill>

      {vo ? <Audio src={staticFile(vo)} /> : null}
      {music ? <Audio src={staticFile(music)} volume={0.3} /> : null}
      {draft ? <DraftOverlay sceneId="s01" /> : null}
    </AbsoluteFill>
  );
};
