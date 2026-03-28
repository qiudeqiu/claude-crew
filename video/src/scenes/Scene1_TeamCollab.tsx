import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { CONFIG, BUBBLES } from "../data/bubbles";
import { sec, computePositions } from "../helpers";
import { ChatHeader } from "../components/ChatHeader";
import { GitHubCard, ProjectBadge } from "../components/GitHubCard";
import { MessageList } from "../components/MessageList";
import { Camera } from "../components/Camera";
import { AppleTextCard } from "../components/AppleTextCard";

// Filter Phase 1-7, chat at 1.5x speed
const FIRST_BUBBLE_TIME = 0.5;
const TARGET_START = 2.3; // first bubble after opening text
const PACE = 0.53; // 1.5x speed for chat content only

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

// Opening 1x: 0-2.2s | Chat 1.5x: 2.3-20.5s | Closing 1x: 21-27s
export const SCENE1_DURATION = 30;

export const Scene1_TeamCollab: React.FC = () => {
  const frame = useCurrentFrame();
  const { canvas, chat } = CONFIG;
  const chatLeft = (canvas.width - chat.width) / 2;

  // Chat fade in/out — sharp 0.15s
  const chatOpacity = interpolate(frame, [sec(2.15), sec(2.3)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chatFadeOut = interpolate(frame, [sec(20.8), sec(20.95)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showChat = frame >= sec(2.1) && frame < sec(21.5);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Project badge — above text, visible from start */}
      <ProjectBadge
        opacity={interpolate(
          frame,
          [0, sec(0.2), sec(2.0), sec(2.2)],
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        )}
        position="above"
      />

      {/* Opening text card — 1x speed */}
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
        startTime={0.3}
        fadeOutTime={2.0}
      />

      {/* Chat scene — 1.5x speed */}
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
                  background: "rgba(255,255,255,0.72)",
                  backdropFilter: "blur(40px) saturate(1.8)",
                  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
                  borderRadius: 24,
                  boxShadow:
                    "0 2px 24px rgba(0,0,0,0.05), 0 0 1px rgba(0,0,0,0.08)",
                  border: "1px solid rgba(255,255,255,0.6)",
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

      {/* Closing text card — 1x speed */}
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
        startTime={21.2}
        fadeOutTime={25.5}
      />

      {/* GitHub card at the end */}
      <GitHubCard startTime={26} />
    </AbsoluteFill>
  );
};
