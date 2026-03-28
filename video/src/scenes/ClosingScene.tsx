import React from "react";
import { AbsoluteFill, useCurrentFrame, spring, interpolate } from "remotion";
import { CLOSING, CONFIG } from "../data/bubbles";
import { fontFamilyInter } from "../fonts";
import { sec } from "../helpers";

export const ClosingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const fps = CONFIG.fps;

  // Group 1: lines 0-2 (一个群, 所有产品, 整个团队)
  // Group 2: lines 3-4 (任务·进度·结果·讨论, 同一条时间线)
  // GitHub card at 63s

  const group1 = CLOSING.slice(0, 3);
  const group2 = CLOSING.slice(3, 5);

  // Group 1 visible from 58s, fade out at ~61s
  const group1Opacity = interpolate(
    frame,
    [sec(58), sec(58.4), sec(60.5), sec(61)],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // Group 2 visible from 61s, fade out by 62.5s
  const group2Opacity = interpolate(
    frame,
    [sec(61), sec(61.3), sec(62.2), sec(62.5)],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // GitHub card from 62.5s (seamless after group2)
  const cardOpacity = interpolate(frame, [sec(62.5), sec(62.9)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.closing.background }}>
      {/* Group 1: 一个群 / 所有产品 / 整个团队 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: group1Opacity,
          gap: 16,
        }}
      >
        {group1.map((item, i) => {
          const enterFrame = sec(item.time);
          const rel = frame - enterFrame;
          // Spring scale entrance per line
          const springVal =
            rel >= 0
              ? spring({
                  fps,
                  frame: rel,
                  config: { damping: 15, stiffness: 150 },
                })
              : 0;
          const textScale = interpolate(springVal, [0, 1], [0.8, 1]);
          const itemOpacity = interpolate(rel, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <span
              key={i}
              style={{
                fontFamily: fontFamilyInter,
                fontSize: item.fontSize,
                fontWeight: 700,
                color: item.color,
                opacity: itemOpacity,
                transform: `scale(${textScale})`,
              }}
            >
              {item.text}
            </span>
          );
        })}
      </div>

      {/* Group 2: 任务·进度·结果·讨论 / 同一条时间线 */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: group2Opacity,
          gap: 12,
        }}
      >
        {group2.map((item, i) => {
          const enterFrame = sec(item.time);
          const rel = frame - enterFrame;
          const springVal =
            rel >= 0
              ? spring({
                  fps,
                  frame: rel,
                  config: { damping: 15, stiffness: 150 },
                })
              : 0;
          const textScale = interpolate(springVal, [0, 1], [0.8, 1]);
          const itemOpacity = interpolate(rel, [0, 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          });
          return (
            <span
              key={i}
              style={{
                fontFamily: fontFamilyInter,
                fontSize: item.fontSize,
                fontWeight: 600,
                color: item.color,
                opacity: itemOpacity,
                transform: `scale(${textScale})`,
              }}
            >
              {item.text}
            </span>
          );
        })}
      </div>

      {/* GitHub Card */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          opacity: cardOpacity,
        }}
      >
        <div
          style={{
            backgroundColor: CONFIG.closing.githubCard.fill,
            border: `1px solid ${CONFIG.closing.githubCard.stroke}`,
            borderRadius: CONFIG.closing.githubCard.cornerRadius,
            padding: "48px 64px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
          }}
        >
          {/* GitHub icon */}
          <svg width="80" height="80" viewBox="0 0 24 24" fill="#1C1C1E">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>

          <span
            style={{
              fontFamily: fontFamilyInter,
              fontSize: 42,
              fontWeight: 700,
              color: "#1C1C1E",
            }}
          >
            {CONFIG.closing.githubCard.repo}
          </span>

          <span
            style={{
              fontFamily: fontFamilyInter,
              fontSize: 28,
              color: "#8E8E93",
            }}
          >
            Open Source | GitHub
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
