import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { CONFIG } from "../data/bubbles";
import { fontFamilyInter } from "../fonts";
import { sec } from "../helpers";

/**
 * Apple-style opening title card.
 * Clean text on dark background with spring-based fade animations.
 *
 * Timeline:
 * 0.0s - 0.4s: "所有产品，所有人" springs in
 * 0.6s - 1.0s: "一个 Telegram 群" springs in below
 * 1.0s - 1.4s: "claude-crew" subtitle fades in
 * 2.0s - 2.8s: everything fades out, chat begins to appear
 */
export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = CONFIG.fps;

  // Overall scene opacity (allow chat to show through at end)
  const sceneOpacity = interpolate(frame, [sec(2.0), sec(2.8)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (sceneOpacity <= 0) return null;

  // Line 1: spring scale + fade
  const line1Rel = frame - sec(0);
  const line1Spring =
    line1Rel >= 0
      ? spring({
          fps,
          frame: line1Rel,
          config: { damping: 15, stiffness: 150 },
        })
      : 0;
  const line1Scale = interpolate(line1Spring, [0, 1], [0.85, 1]);
  const line1Opacity = interpolate(
    frame,
    [sec(0), sec(0.4), sec(2.0), sec(2.5)],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease),
    },
  );

  // Line 2: spring scale + fade
  const line2Rel = frame - sec(0.6);
  const line2Spring =
    line2Rel >= 0
      ? spring({
          fps,
          frame: line2Rel,
          config: { damping: 15, stiffness: 150 },
        })
      : 0;
  const line2Scale = interpolate(line2Spring, [0, 1], [0.85, 1]);
  const line2Opacity = interpolate(
    frame,
    [sec(0.6), sec(1.0), sec(2.0), sec(2.5)],
    [0, 1, 1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.ease),
    },
  );

  // Subtitle line
  const subOpacity = interpolate(
    frame,
    [sec(1.0), sec(1.4), sec(2.0), sec(2.5)],
    [0, 0.7, 0.7, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: CONFIG.background,
        opacity: sceneOpacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontFamily: fontFamilyInter,
          fontSize: 64,
          fontWeight: 700,
          color: "#FAFAFA",
          opacity: line1Opacity,
          transform: `scale(${line1Scale})`,
          letterSpacing: "-0.02em",
        }}
      >
        所有项目，所有人
      </span>
      <span
        style={{
          fontFamily: fontFamilyInter,
          fontSize: 64,
          fontWeight: 700,
          color: "#FAFAFA",
          opacity: line2Opacity,
          transform: `scale(${line2Scale})`,
          letterSpacing: "-0.02em",
        }}
      >
        一个 Telegram 群
      </span>
      <span
        style={{
          fontFamily: fontFamilyInter,
          fontSize: 28,
          fontWeight: 400,
          color: "#6B7280",
          opacity: subOpacity,
          marginTop: 12,
        }}
      >
        claude-crew
      </span>
    </AbsoluteFill>
  );
};
