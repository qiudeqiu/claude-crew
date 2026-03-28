import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { CONFIG, BUBBLES } from "../data/bubbles";
import { sec, computePositions } from "../helpers";
import { ChatHeader } from "../components/ChatHeader";
import { MessageList } from "../components/MessageList";
import { Camera } from "../components/Camera";
import { AppleTextCard } from "../components/AppleTextCard";

// Filter Phase 1-7, compress to 1.5x native speed
const FIRST_BUBBLE_TIME = 0.5;
const TARGET_START = 1.5; // first bubble appears at 1.5s
const PACE = 0.53; // ~1.5x speed (0.80 / 1.5)

const SCENE1_BUBBLES = BUBBLES.filter((b) => {
  const p = b.phase;
  return (
    p.startsWith("1-") ||
    p.startsWith("2-") ||
    p.startsWith("3-") ||
    p.startsWith("4-") ||
    p.startsWith("5-") ||
    p.startsWith("6-") ||
    p.startsWith("7-")
  );
}).map((b) => ({
  ...b,
  time: TARGET_START + (b.time - FIRST_BUBBLE_TIME) * PACE,
}));

const SCENE1_POSITIONS = computePositions(SCENE1_BUBBLES);

// Last bubble: 1.5 + (34.5 - 0.5) * 0.53 ≈ 19.5s
export const SCENE1_DURATION = 26;

export const Scene1_TeamCollab: React.FC = () => {
  const frame = useCurrentFrame();
  const { canvas, chat } = CONFIG;
  const chatLeft = (canvas.width - chat.width) / 2;

  // Opening text: 0.2 - 1.3s
  // Chat: 1.3 - 21s
  // Closing: 21 - 26s

  const chatOpacity = interpolate(frame, [sec(1.3), sec(1.45)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const chatFadeOut = interpolate(frame, [sec(20.5), sec(20.65)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const showChat = frame >= sec(1.2) && frame < sec(21);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Opening text card */}
      <AppleTextCard
        lines={[
          {
            segments: [{ text: "所有", color: "#007AFF" }, { text: "项目，" }],
            fontSize: 96,
          },
          {
            segments: [{ text: "所有", color: "#007AFF" }, { text: "人。" }],
            fontSize: 96,
          },
          { text: "一个 Telegram 群", fontSize: 56, color: "#8E8E93" },
          {
            segments: [{ text: "搞定", color: "#007AFF" }, { text: "全部。" }],
            fontSize: 96,
          },
        ]}
        startTime={0.2}
        fadeOutTime={1.2}
        lineDelay={16}
      />

      {/* Chat scene */}
      {showChat && (
        <div style={{ opacity: chatOpacity * chatFadeOut }}>
          <Camera positions={SCENE1_POSITIONS}>
            <AbsoluteFill
              style={{
                background: "linear-gradient(180deg, #F5F5F7 0%, #ECECEE 100%)",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: chatLeft,
                  top: 20,
                  width: chat.width,
                  backgroundColor: "#FFFFFF",
                  borderRadius: 24,
                  boxShadow:
                    "0 2px 20px rgba(0,0,0,0.06), 0 0 1px rgba(0,0,0,0.1)",
                  overflow: "hidden",
                }}
              >
                <ChatHeader />
                <div style={{ padding: "0" }}>
                  <MessageList bubbles={SCENE1_BUBBLES} />
                </div>
              </div>
            </AbsoluteFill>
          </Camera>
        </div>
      )}

      {/* Closing text card */}
      <AppleTextCard
        lines={[
          {
            text: "不需要再傻傻截图转发。",
            fontSize: 64,
            color: "#8E8E93",
          },
          {
            segments: [{ text: "任务 · 进度 · 结果 · 讨论", color: "#007AFF" }],
            fontSize: 72,
          },
          {
            segments: [
              { text: "直接开干。", color: "#1C1C1E" },
              { text: " 💪" },
            ],
            fontSize: 96,
          },
        ]}
        startTime={21}
        lineDelay={20}
      />
    </AbsoluteFill>
  );
};
