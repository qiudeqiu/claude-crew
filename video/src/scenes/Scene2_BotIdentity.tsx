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
import { AppleTextCard } from "../components/AppleTextCard";

const W = CONFIG.canvas.width;
const H = CONFIG.canvas.height;
const CX = W / 2;
const CY = H / 2 - 40;
const FPS = CONFIG.fps;

/** Identity labels that radiate from the center bot */
const IDENTITIES = [
  { emoji: "💻", label: "全栈项目", angle: -90 },
  { emoji: "🔍", label: "Code Review", angle: -45 },
  { emoji: "✍️", label: "写作助手", angle: 0 },
  { emoji: "🎓", label: "技术导师", angle: 45 },
  { emoji: "📊", label: "数据分析", angle: 90 },
  { emoji: "🎨", label: "设计系统", angle: 135 },
  { emoji: "🚀", label: "DevOps", angle: 180 },
  { emoji: "🌐", label: "翻译引擎", angle: -135 },
];

const RADIUS = 360; // distance from center to identity cards
const CENTER_SIZE = 120; // center bot circle size
const CARD_SIZE = 130; // identity card size

/**
 * Scene 2: One Bot = Many Identities
 *
 * 0-2.5s:   Opening text card
 * 2.5-10s:  Radial expansion animation
 * 10-15s:   Closing text card
 */
export const SCENE2_DURATION = 15;

export const Scene2_BotIdentity: React.FC = () => {
  const frame = useCurrentFrame();

  // Animation phase: center bot appears at 3s, identities spread 3.5-6s
  const centerAppearFrame = sec(3);
  const spreadStart = sec(3.8);

  // Center bot spring
  const centerRel = frame - centerAppearFrame;
  const centerSpring =
    centerRel >= 0
      ? spring({ fps: FPS, frame: centerRel, config: { damping: 14, stiffness: 180 } })
      : 0;
  const centerScale = interpolate(centerSpring, [0, 1], [0, 1]);
  const centerOpacity = interpolate(centerRel, [0, 4], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Fade out animation content before closing
  const contentFadeOut = interpolate(
    frame,
    [sec(9.5), sec(9.8)],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const showAnimation = frame >= centerAppearFrame - 5 && frame < sec(10.5);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Opening text card */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "一个 ", color: "#8E8E93" },
              { text: "bot", color: "#007AFF" },
              { text: "，" },
            ],
            fontSize: 88,
          },
          { text: "可以是一个项目、", fontSize: 56, color: "#1C1C1E" },
          { text: "一个 Agent、一个 Skill、", fontSize: 56, color: "#1C1C1E" },
          {
            segments: [
              { text: "一位导师，可以是" },
              { text: "一切", color: "#007AFF" },
              { text: "。" },
            ],
            fontSize: 56,
          },
        ]}
        startTime={0.2}
        fadeOutTime={2.5}
        lineDelay={14}
      />

      {/* Radial expansion animation */}
      {showAnimation && (
        <AbsoluteFill style={{ opacity: contentFadeOut }}>
          {/* Connection lines */}
          <svg
            width={W}
            height={H}
            style={{ position: "absolute", top: 0, left: 0 }}
          >
            {IDENTITIES.map((id, i) => {
              const delay = i * 3;
              const lineRel = frame - spreadStart - delay;
              const lineProgress =
                lineRel >= 0
                  ? spring({
                      fps: FPS,
                      frame: lineRel,
                      config: { damping: 20, stiffness: 100 },
                    })
                  : 0;

              const rad = (id.angle * Math.PI) / 180;
              const ex = CX + Math.cos(rad) * RADIUS * lineProgress;
              const ey = CY + Math.sin(rad) * RADIUS * lineProgress;

              return (
                <line
                  key={i}
                  x1={CX}
                  y1={CY}
                  x2={ex}
                  y2={ey}
                  stroke="#E0E0E0"
                  strokeWidth={1.5}
                  strokeDasharray="6,4"
                  opacity={lineProgress * 0.6}
                />
              );
            })}
          </svg>

          {/* Identity cards */}
          {IDENTITIES.map((id, i) => {
            const delay = i * 3;
            const cardRel = frame - spreadStart - delay;
            const cardSpring =
              cardRel >= 0
                ? spring({
                    fps: FPS,
                    frame: cardRel,
                    config: { damping: 16, stiffness: 160 },
                  })
                : 0;

            const rad = (id.angle * Math.PI) / 180;
            const x = CX + Math.cos(rad) * RADIUS * cardSpring - CARD_SIZE / 2;
            const y = CY + Math.sin(rad) * RADIUS * cardSpring - CARD_SIZE / 2;
            const cardOpacity = interpolate(cardRel, [0, 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: x,
                  top: y,
                  width: CARD_SIZE,
                  height: CARD_SIZE,
                  borderRadius: 24,
                  backgroundColor: "#FFFFFF",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  opacity: cardOpacity,
                  transform: `scale(${interpolate(cardSpring, [0, 1], [0.5, 1])})`,
                }}
              >
                <span style={{ fontSize: 40, lineHeight: 1 }}>{id.emoji}</span>
                <span
                  style={{
                    fontFamily: fontFamilyInter,
                    fontSize: 18,
                    fontWeight: 600,
                    color: "#1C1C1E",
                    textAlign: "center",
                    lineHeight: 1.2,
                  }}
                >
                  {id.label}
                </span>
              </div>
            );
          })}

          {/* Center bot circle — on top */}
          <div
            style={{
              position: "absolute",
              left: CX - CENTER_SIZE / 2,
              top: CY - CENTER_SIZE / 2,
              width: CENTER_SIZE,
              height: CENTER_SIZE,
              borderRadius: "50%",
              background: "#007AFF",
              boxShadow: "0 4px 24px rgba(0,122,255,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transform: `scale(${centerScale})`,
              opacity: centerOpacity,
            }}
          >
            <span style={{ fontSize: 52, lineHeight: 1 }}>🤖</span>
          </div>
        </AbsoluteFill>
      )}

      {/* Closing text card */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "只需一个" },
              { text: "绝对路径", color: "#007AFF" },
              { text: "，" },
            ],
            fontSize: 80,
          },
          {
            segments: [
              { text: "它一定" },
              { text: "坚守岗位", color: "#1C1C1E" },
              { text: "。 🤖" },
            ],
            fontSize: 80,
          },
        ]}
        startTime={10.2}
      />
    </AbsoluteFill>
  );
};
