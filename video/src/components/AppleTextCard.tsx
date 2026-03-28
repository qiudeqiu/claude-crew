import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate, Easing } from "remotion";
import { CONFIG } from "../data/bubbles";
import { fontFamilyInter } from "../fonts";
import { sec } from "../helpers";

/**
 * Apple-style text card — large, left-aligned, two-tone,
 * per-line staggered fade-in with barely-perceptible upward drift.
 *
 * Supports mixed-color segments within a single line
 * for keyword accent coloring (social media thumbnail appeal).
 */

export interface TextSegment {
  text: string;
  color?: string;
}

export interface TextLine {
  /** Plain text (used when no segments) */
  text?: string;
  /** Mixed-color segments within this line */
  segments?: TextSegment[];
  /** Font size in px (default 96) */
  fontSize?: number;
  /** Text color for plain text (default #1C1C1E) */
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
  /** Delay between each line in frames (default 24 @ 60fps ≈ 400ms) */
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

        const baseStyle: React.CSSProperties = {
          fontFamily: fontFamilyInter,
          fontSize: line.fontSize ?? 96,
          fontWeight: line.fontWeight ?? 700,
          opacity,
          transform: `translateY(${translateY}px)`,
          letterSpacing: "-0.03em",
          lineHeight: 1.15,
        };

        // Render segments if provided, otherwise plain text
        if (line.segments) {
          return (
            <span key={i} style={{ ...baseStyle, color: line.color ?? "#1C1C1E" }}>
              {line.segments.map((seg, j) => (
                <span key={j} style={seg.color ? { color: seg.color } : undefined}>
                  {seg.text}
                </span>
              ))}
            </span>
          );
        }

        return (
          <span key={i} style={{ ...baseStyle, color: line.color ?? "#1C1C1E" }}>
            {line.text}
          </span>
        );
      })}
    </AbsoluteFill>
  );
};
