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
 * Scene 4: Solo Commander — one user commands all bots
 * 4 rapid-fire commands → 4 parallel progress → 4 results → "完美"
 */

const SCENE4_BUBBLES: Bubble[] = [
  // ── Rapid-fire 4 commands ──
  {
    id: "s4-cmd1",
    time: 0.3,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@商城_bot 把支付超时从 30s 改成 60s，加个重试",
    font: "Inter",
    phase: "s4-cmd",
  },
  {
    id: "s4-cmd2",
    time: 1.1,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@官网_bot 首页 hero 区文案换成春季版",
    font: "Inter",
    phase: "s4-cmd",
  },
  {
    id: "s4-cmd3",
    time: 1.8,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@小程序_bot 暗黑模式适配一下新组件库",
    font: "Inter",
    phase: "s4-cmd",
  },
  {
    id: "s4-cmd4",
    time: 2.4,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@活动_bot 生成一份 A/B 测试方案",
    font: "Inter",
    phase: "s4-cmd",
  },
  // ── 4 bots working in parallel ──
  {
    id: "s4-p1",
    time: 3.2,
    sender: "商城_bot",
    side: "left",
    type: "progress",
    nameLabel: "商城_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (3s)\n → 🔧 Edit: payment.config.ts",
    font: "JetBrains Mono",
    phase: "s4-work",
  },
  {
    id: "s4-p2",
    time: 3.6,
    sender: "官网_bot",
    side: "left",
    type: "progress",
    nameLabel: "官网_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (2s)\n → 🔧 Edit: hero-section.tsx",
    font: "JetBrains Mono",
    phase: "s4-work",
  },
  {
    id: "s4-p3",
    time: 4.0,
    sender: "小程序_bot",
    side: "left",
    type: "progress",
    nameLabel: "小程序_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (4s)\n → 🔧 Read: components/*.tsx",
    font: "JetBrains Mono",
    phase: "s4-work",
  },
  {
    id: "s4-p4",
    time: 4.3,
    sender: "活动_bot",
    side: "left",
    type: "progress",
    nameLabel: "活动_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (2s)\n → 🔧 Write: ab-test-plan.md",
    font: "JetBrains Mono",
    phase: "s4-work",
  },
  // ── 4 results ──
  {
    id: "s4-r1",
    time: 5.5,
    sender: "商城_bot",
    side: "left",
    type: "result",
    nameLabel: "商城_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 超时已改为 60s + 添加 3 次重试逻辑，单元测试通过",
    font: "Inter",
    phase: "s4-result",
  },
  {
    id: "s4-r2",
    time: 6.2,
    sender: "官网_bot",
    side: "left",
    type: "result",
    nameLabel: "官网_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ Hero 文案已更新为春季版，CTA 按钮和副标题同步调整",
    font: "Inter",
    phase: "s4-result",
  },
  {
    id: "s4-r3",
    time: 6.8,
    sender: "小程序_bot",
    side: "left",
    type: "result",
    nameLabel: "小程序_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 暗黑模式已适配 12 个新组件，色值和间距全部对齐设计稿",
    font: "Inter",
    phase: "s4-result",
  },
  {
    id: "s4-r4",
    time: 7.4,
    sender: "活动_bot",
    side: "left",
    type: "result",
    nameLabel: "活动_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ A/B 测试方案已生成：3 组变量 × 2 个转化指标，预计 7 天出结果",
    font: "Inter",
    phase: "s4-result",
  },
  // ── Mic drop ──
  {
    id: "s4-done",
    time: 8.5,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "完美 👏",
    font: "Inter",
    phase: "s4-done",
  },
];

// Chat at 1.5x speed
const CHAT_START = 2.5;
const PACE = 0.65;
const OFFSET_BUBBLES = SCENE4_BUBBLES.map((b) => ({
  ...b,
  time: CHAT_START + b.time * PACE,
}));
const POSITIONS = computePositions(OFFSET_BUBBLES);

// Custom header for solo commander group
const SoloHeader: React.FC = () => {
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
          background: "linear-gradient(135deg, #FFD700, #FFA500)",
          boxShadow: "0 4px 12px rgba(255,165,0,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          flexShrink: 0,
        }}
      >
        👑
      </div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: 36,
            fontWeight: 700,
            color: "#1C1C1E",
          }}
        >
          我的 Bot 军团
        </span>
        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: 22,
            color: "#AEAEB2",
          }}
        >
          商城_bot, 官网_bot, 小程序_bot, 活动_bot
        </span>
      </div>
    </div>
  );
};

/**
 * Timeline: Opening 0-2.3s | Chat 2.3-11s | Closing 11-15s | GitHub 15.5-19s
 */
export const SCENE4_DURATION = 19;

export const Scene4_SoloCommander: React.FC = () => {
  const frame = useCurrentFrame();
  const { canvas, chat } = CONFIG;
  const chatLeft = (canvas.width - chat.width) / 2;

  const chatOpacity = interpolate(frame, [sec(2.2), sec(2.35)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chatFadeOut = interpolate(frame, [sec(10.5), sec(10.65)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showChat = frame >= sec(2.1) && frame < sec(11);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Project badge */}
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
        textBlockHeight={260}
      />

      {/* Opening text */}
      <AppleTextCard
        lines={[
          { text: "如果你是一位", fontSize: 72, color: "#8E8E93" },
          {
            segments: [{ text: "独行侠", color: "#007AFF" }, { text: "…" }],
            fontSize: 96,
          },
        ]}
        startTime={0.3}
        fadeOutTime={2.0}
      />

      {/* Chat — solo commander */}
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
                <SoloHeader />
                <div style={{ padding: "0" }}>
                  <MessageList bubbles={OFFSET_BUBBLES} />
                </div>
              </div>

              {/* Crown badges on right-side (user) bubbles */}
              <CrownOverlay bubbles={OFFSET_BUBBLES} chatLeft={chatLeft} />
            </GlassBackground>
          </Camera>
        </div>
      )}

      {/* Closing text */}
      <AppleTextCard
        lines={[
          { text: "是时候展示你的", fontSize: 64, color: "#8E8E93" },
          {
            segments: [
              { text: "绝佳领导才能", color: "#007AFF" },
              { text: "。👑" },
            ],
            fontSize: 80,
          },
        ]}
        startTime={11}
        fadeOutTime={14.5}
      />

      {/* GitHub card */}
      <GitHubCard startTime={15} />
    </AbsoluteFill>
  );
};

/** Renders small 👑 badges on right-aligned bubbles */
const CrownOverlay: React.FC<{
  bubbles: Bubble[];
  chatLeft: number;
}> = () => {
  // Crown is already conveyed by the golden header avatar
  // and the group name "我的 Bot 军团" — no need for per-bubble crowns
  // which would be visually noisy. Keeping this as a no-op.
  return null;
};
