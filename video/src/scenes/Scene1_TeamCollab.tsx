import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { CONFIG, BUBBLES } from "../data/bubbles";
import { sec, computePositions } from "../helpers";
import { ChatHeader } from "../components/ChatHeader";
import { MessageList } from "../components/MessageList";
import { Camera } from "../components/Camera";
import { AppleTextCard } from "../components/AppleTextCard";

// Filter Phase 1-7 and offset times so first bubble syncs with chat fade-in
const BUBBLE_OFFSET = 1.8; // shift so first bubble (0.5s) lands at ~2.3s

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
}).map((b) => ({ ...b, time: b.time + BUBBLE_OFFSET }));

const SCENE1_POSITIONS = computePositions(SCENE1_BUBBLES);

/**
 * Scene 1: Team Collaboration
 *
 * 0-2.2s:   Opening text card (Apple style)
 * 2.2-36s:  Chat scene (Phase 1-7)
 * 36-42s:   Closing text card
 */
export const SCENE1_DURATION = 44;

export const Scene1_TeamCollab: React.FC = () => {
  const frame = useCurrentFrame();
  const { canvas, chat } = CONFIG;
  const chatLeft = (canvas.width - chat.width) / 2;

  // Chat fades in — Apple-sharp: 0.15s transition
  const chatOpacity = interpolate(frame, [sec(2.2), sec(2.35)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Chat fades out — same: 0.15s snap
  const chatFadeOut = interpolate(frame, [sec(37.5), sec(37.65)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const showChat = frame >= sec(2.1) && frame < sec(38);

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
        startTime={0.3}
        fadeOutTime={2.1}
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
              {/* Chat container card */}
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
            segments: [
              { text: "任务", color: "#007AFF" },
              { text: " · 进度 · 结果 · " },
              { text: "讨论", color: "#34C759" },
            ],
            fontSize: 72,
          },
          {
            segments: [
              { text: "直接" },
              { text: "开干", color: "#007AFF" },
              { text: " 💪" },
            ],
            fontSize: 96,
          },
        ]}
        startTime={38}
        lineDelay={28}
      />
    </AbsoluteFill>
  );
};
