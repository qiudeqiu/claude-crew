import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { CONFIG, BUBBLES } from "../data/bubbles";
import { sec, computePositions } from "../helpers";
import { ChatHeader } from "../components/ChatHeader";
import { MessageList } from "../components/MessageList";
import { Camera } from "../components/Camera";
import { AppleTextCard } from "../components/AppleTextCard";

// Filter out Phase 9 (new bot creation) — keep Phase 1-7 only
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
});

const SCENE1_POSITIONS = computePositions(SCENE1_BUBBLES);

/**
 * Scene 1: Team Collaboration
 *
 * 0-2.2s:   Opening text card (Apple style)
 * 2.2-36s:  Chat scene (Phase 1-7)
 * 36-42s:   Closing text card
 */
export const SCENE1_DURATION = 42;

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
  const chatFadeOut = interpolate(frame, [sec(35.8), sec(35.95)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const showChat = frame >= sec(2.1) && frame < sec(36.5);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Opening text card */}
      <AppleTextCard
        lines={[
          { text: "所有项目，", fontSize: 96, color: "#1C1C1E" },
          { text: "所有人。", fontSize: 96, color: "#1C1C1E" },
          { text: "一个 Telegram 群", fontSize: 56, color: "#8E8E93" },
          { text: "搞定全部。", fontSize: 96, color: "#1C1C1E" },
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
            text: "任务 · 进度 · 结果 · 讨论",
            fontSize: 72,
            color: "#1C1C1E",
          },
          { text: "直接开干 💪", fontSize: 96, color: "#1C1C1E" },
        ]}
        startTime={36.2}
        lineDelay={28}
      />
    </AbsoluteFill>
  );
};
