import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { CONFIG } from "../data/bubbles";
import { fontFamilyInter } from "../fonts";
import { sec } from "../helpers";

/**
 * Apple-style text card — large, left-aligned, two-tone,
 * per-line staggered fade-in with barely-perceptible upward drift.
 *
 * Matches Apple's timing:
 * - ~500ms between lines (15 frames at 30fps)
 * - ~100ms fade-in per line (3 frames)
 * - ~4px upward drift (subtle)
 * - text holds after appearing before next line
 */

export interface TextLine {
  text: string;
  /** Font size in px (default 96) */
  fontSize?: number;
  /** Text color (default #1C1C1E) */
  color?: string;
  /** Font weight (default 700) */
  fontWeight?: number;
}

interface AppleTextCardProps {
  lines: TextLine[];
  /** When the first line starts appearing (seconds) */
  startTime: number;
  /** When to start fading everything out (seconds). If omitted, stays visible. */
  fadeOutTime?: number;
  /** Background color (default transparent) */
  background?: string;
  /** Delay between each line in frames (default 12 ≈ 400ms) */
  lineDelay?: number;
  /** Left padding in px (default 80) */
  paddingLeft?: number;
}

export const AppleTextCard: React.FC<AppleTextCardProps> = ({
  lines,
  startTime,
  fadeOutTime,
  background,
  lineDelay = 24,
  paddingLeft = 80,
}) => {
  const frame = useCurrentFrame();
  const startFrame = sec(startTime);

  // Overall fade out — quick and decisive, ~200ms
  const fadeOutFrames = Math.round(CONFIG.fps * 0.2);
  const fadeOut =
    fadeOutTime !== undefined
      ? interpolate(
          frame,
          [sec(fadeOutTime), sec(fadeOutTime) + fadeOutFrames],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )
      : 1;

  if (fadeOut <= 0) return null;
  if (frame < startFrame - 2) return null;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: background,
        opacity: fadeOut,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        paddingLeft,
        paddingRight: 80,
        gap: 6,
      }}
    >
      {lines.map((line, i) => {
        const lineFrame = startFrame + i * lineDelay;
        const rel = frame - lineFrame;

        // Per-line: ~100ms fade + ~130ms drift — Apple-matched, fps-aware
        const fadeFrames = Math.round(CONFIG.fps * 0.1);
        const driftFrames = Math.round(CONFIG.fps * 0.13);
        const opacity = interpolate(rel, [0, fadeFrames], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.ease),
        });
        const translateY = interpolate(rel, [0, driftFrames], [4, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.out(Easing.cubic),
        });

        return (
          <span
            key={i}
            style={{
              fontFamily: fontFamilyInter,
              fontSize: line.fontSize ?? 96,
              fontWeight: line.fontWeight ?? 700,
              color: line.color ?? "#1C1C1E",
              opacity,
              transform: `translateY(${translateY}px)`,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
            }}
          >
            {line.text}
          </span>
        );
      })}
    </AbsoluteFill>
  );
};
