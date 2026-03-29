import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { CONFIG } from "../data/bubbles";
import type { Bubble } from "../data/bubbles";
import { sec, computePositions } from "../helpers";
import { fontFamilyInter, fontFamilyMono } from "../fonts";
import { MessageList } from "../components/MessageList";
import { Camera } from "../components/Camera";
import { AppleTextCard } from "../components/AppleTextCard";
import { GitHubCard, ProjectBadge } from "../components/GitHubCard";
import { GlassBackground } from "../components/GlassBackground";

/**
 * Scene 5: Memory Continuity — bot remembers previous work across sessions.
 * 1v1 chat with time separators showing Mon/Wed/Fri conversations.
 */

const SCENE5_BUBBLES: Bubble[] = [
  // ── Monday 09:12 ──
  {
    id: "s5-mon-u1",
    time: 0.3,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "帮我重构一下 auth 模块，太乱了",
    font: "Inter",
    phase: "s5-mon",
  },
  {
    id: "s5-mon-r1",
    time: 1.6,
    sender: "项目_bot",
    side: "left",
    type: "result",
    nameLabel: "项目_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content:
      "✅ 已拆成 auth-core.ts / auth-middleware.ts / auth-utils.ts，13 个测试全部通过",
    font: "Inter",
    phase: "s5-mon",
  },

  // ── Wednesday 15:30 ──
  {
    id: "s5-wed-u1",
    time: 3.5,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "auth 模块加个双因素认证",
    font: "Inter",
    phase: "s5-wed",
  },
  {
    id: "s5-wed-r1",
    time: 5.0,
    sender: "项目_bot",
    side: "left",
    type: "result",
    nameLabel: "项目_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content:
      "✅ 基于周一重构的 auth-core 添加了 2FA 支持，复用了你的 token 验证逻辑",
    font: "Inter",
    phase: "s5-wed",
  },

  // ── Friday 10:00 ──
  {
    id: "s5-fri-u1",
    time: 7.0,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "auth 这块现在覆盖率多少",
    font: "Inter",
    phase: "s5-fri",
  },
  {
    id: "s5-fri-r1",
    time: 8.5,
    sender: "项目_bot",
    side: "left",
    type: "result",
    nameLabel: "项目_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content:
      "✅ 整体 83%，其中 auth-core 92%、2FA 模块 71%，需要补边界用例测试",
    font: "Inter",
    phase: "s5-fri",
  },
];

// Chat at 1.5x speed
const CHAT_START = 2.8;
const PACE = 0.65;
const OFFSET_BUBBLES = SCENE5_BUBBLES.map((b) => ({
  ...b,
  time: CHAT_START + b.time * PACE,
}));
const POSITIONS = computePositions(OFFSET_BUBBLES);

// Phase → day separator labels
const DAY_LABELS: Record<string, string> = {
  "s5-mon": "周一 09:12",
  "s5-wed": "周三 15:30",
  "s5-fri": "周五 10:00",
};

// Custom header for 1v1 project bot chat
const ProjectHeader: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, sec(0.3)], [0, 1], {
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        width: CONFIG.chat.width,
        height: CONFIG.chat.headerHeight,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
        opacity,
        background: "rgba(245,245,247,0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        borderRadius: "24px 24px 0 0",
      }}
    >
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: "50%",
          background: "linear-gradient(135deg, #007AFF, #5AC8FA)",
          boxShadow: "0 4px 12px rgba(0,122,255,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          flexShrink: 0,
        }}
      >
        🤖
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              fontFamily: fontFamilyInter,
              fontSize: 36,
              fontWeight: 700,
              color: "#1C1C1E",
            }}
          >
            项目_bot
          </span>
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: "50%",
              backgroundColor: "#34C759",
              flexShrink: 0,
            }}
          />
        </div>
        <span
          style={{
            fontFamily: fontFamilyMono,
            fontSize: 22,
            color: "#007AFF",
          }}
        >
          ~/projects/my-app
        </span>
      </div>
    </div>
  );
};

/**
 * Custom message list with day separators.
 * Renders bubbles with pill-shaped day labels between phase changes.
 */
const MemoryMessageList: React.FC<{ bubbles: Bubble[] }> = ({ bubbles }) => {
  const frame = useCurrentFrame();
  const currentTime = frame / CONFIG.fps;

  const active = bubbles.filter((b) => b.time <= currentTime);

  let lastPhase = "";
  const items: Array<
    | { kind: "separator"; label: string; key: string }
    | { kind: "bubble"; bubble: Bubble; key: string }
  > = [];

  for (const b of active) {
    if (b.phase !== lastPhase) {
      const label = DAY_LABELS[b.phase];
      if (label) {
        items.push({ kind: "separator", label, key: `sep-${b.phase}` });
      }
      lastPhase = b.phase;
    }
    items.push({ kind: "bubble", bubble: b, key: b.id });
  }

  return (
    <div
      style={{
        width: CONFIG.chat.width,
        padding: `${CONFIG.chat.messagePadding.y}px ${CONFIG.chat.messagePadding.x}px`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {items.map((item, i) => {
        if (item.kind === "separator") {
          return (
            <div
              key={item.key}
              style={{
                textAlign: "center",
                marginTop: i === 0 ? 4 : 24,
                marginBottom: 16,
              }}
            >
              <span
                style={{
                  fontFamily: fontFamilyInter,
                  fontSize: 21,
                  color: "#AEAEB2",
                  fontWeight: 500,
                  backgroundColor: "rgba(0,0,0,0.04)",
                  padding: "5px 16px",
                  borderRadius: 20,
                }}
              >
                {item.label}
              </span>
            </div>
          );
        }

        const b = item.bubble;
        const appearFrame = sec(b.time);
        const opacity = interpolate(frame - appearFrame, [0, 5], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        if (opacity <= 0) return null;

        const isUser = b.side === "right";
        const isResult = b.type === "result";
        const cr = isUser
          ? CONFIG.bubble.right.cornerRadius
          : CONFIG.bubble.left.cornerRadius;

        return (
          <div
            key={item.key}
            style={{
              marginTop: i === 0 ? 0 : CONFIG.chat.messageGap,
              alignSelf: isUser ? "flex-end" : "flex-start",
              maxWidth: `${CONFIG.bubble[b.side].maxWidthRatio * 100}%`,
              opacity,
            }}
          >
            {/* Name label for bot bubbles */}
            {b.nameLabel && (
              <span
                style={{
                  fontFamily: fontFamilyInter,
                  fontSize: CONFIG.bubble.nameSize,
                  color: b.nameColor,
                  fontWeight: 600,
                  display: "block",
                  marginBottom: 6,
                }}
              >
                {b.nameLabel}
              </span>
            )}
            <div
              style={{
                backgroundColor: b.bubbleColor,
                borderRadius: `${cr[0]}px ${cr[1]}px ${cr[2]}px ${cr[3]}px`,
                borderLeft: isResult ? "3px solid #34C759" : "none",
                padding: `${CONFIG.bubble.padding.y}px ${CONFIG.bubble.padding.x}px`,
              }}
            >
              <span
                style={{
                  fontFamily:
                    b.font === "JetBrains Mono"
                      ? fontFamilyMono
                      : fontFamilyInter,
                  fontSize: CONFIG.bubble.textSize,
                  color: b.textColor,
                  lineHeight: 1.5,
                  whiteSpace: "pre-wrap",
                }}
              >
                {b.content}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Timeline: Opening 0-2.5s | Chat 2.5-12.5s | Closing 12.5-15s | GitHub 15.5-18s
 */
export const SCENE5_DURATION = 18;

export const Scene5_Memory: React.FC = () => {
  const frame = useCurrentFrame();
  const { canvas, chat } = CONFIG;
  const chatLeft = (canvas.width - chat.width) / 2;

  const chatOpacity = interpolate(frame, [sec(2.5), sec(2.65)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chatFadeOut = interpolate(frame, [sec(12.0), sec(12.15)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showChat = frame >= sec(2.35) && frame < sec(12.5);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Project badge */}
      <ProjectBadge
        opacity={interpolate(
          frame,
          [0, sec(0.2), sec(2.0), sec(2.3)],
          [0, 1, 1, 0],
          {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          },
        )}
        textBlockHeight={220}
      />

      {/* Opening text */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "为什么是一个 " },
              { text: "bot", color: "#007AFF" },
              { text: "？" },
            ],
            fontSize: 80,
          },
          {
            segments: [
              { text: "因为这符合我们的" },
              { text: "记忆认知", color: "#007AFF" },
              { text: "。" },
            ],
            fontSize: 64,
            color: "#8E8E93",
          },
        ]}
        startTime={0.3}
        fadeOutTime={2.3}
        lineDelay={24}
      />

      {/* Chat — memory continuity */}
      {showChat && (
        <div style={{ opacity: chatOpacity * chatFadeOut }}>
          <Camera positions={POSITIONS}>
            <GlassBackground>
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
                <ProjectHeader />
                <div style={{ padding: "0" }}>
                  <MemoryMessageList bubbles={OFFSET_BUBBLES} />
                </div>
              </div>
            </GlassBackground>
          </Camera>
        </div>
      )}

      {/* Closing text */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "随时 " },
              { text: "@我", color: "#007AFF" },
              { text: "，" },
            ],
            fontSize: 80,
          },
          { text: "我的老伙计。🙋", fontSize: 80 },
        ]}
        startTime={12.8}
        fadeOutTime={15}
        lineDelay={24}
      />

      {/* GitHub card */}
      <GitHubCard startTime={15.5} />
    </AbsoluteFill>
  );
};
