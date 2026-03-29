import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { CONFIG, BUBBLES } from "../data/bubbles";
import type { Bubble } from "../data/bubbles";
import { sec, computePositions } from "../helpers";
import { ChatHeader } from "../components/ChatHeader";
import { MessageList } from "../components/MessageList";
import { Camera } from "../components/Camera";
import { AppleTextCard } from "../components/AppleTextCard";
import { GitHubCard, ProjectBadge } from "../components/GitHubCard";
import { GlassBackground } from "../components/GlassBackground";
import { fontFamilyInter } from "../fonts";

export const SCENE6_DURATION = 35;

const W = CONFIG.canvas.width;
const H = CONFIG.canvas.height;

// ══════════════════════════════════════════
// Reuse Scene 1 data (team collaboration) for Moment A
// Take Phase 1-7 (full team content) for maximum density
// ══════════════════════════════════════════
const MOMENT_A_START = 6.2;
const MOMENT_A_PACE = 0.65; // comfortable reading pace

const MOMENT_A_BUBBLES = BUBBLES.filter((b) => {
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
  time: MOMENT_A_START + (b.time - 0.5) * MOMENT_A_PACE,
}));
const MOMENT_A_POS = computePositions(MOMENT_A_BUBBLES);

// ══════════════════════════════════════════
// Reuse Scene 4 data (solo commander) for Moment B
// ══════════════════════════════════════════
const MOMENT_B_START = 16.2;
const MOMENT_B_PACE = 0.6;

const SCENE4_BUBBLES: Bubble[] = [
  // ── 4 rapid commands ──
  {
    id: "s6-c1",
    time: 0.3,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@商城_bot 把支付超时从 30s 改成 60s，加个重试",
    font: "Inter",
    phase: "s6-cmd",
  },
  {
    id: "s6-c2",
    time: 0.9,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@官网_bot 首页 hero 区文案换成春季版",
    font: "Inter",
    phase: "s6-cmd",
  },
  {
    id: "s6-c3",
    time: 1.4,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@小程序_bot 暗黑模式适配一下新组件库",
    font: "Inter",
    phase: "s6-cmd",
  },
  {
    id: "s6-c4",
    time: 1.8,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@活动_bot 生成一份 A/B 测试方案",
    font: "Inter",
    phase: "s6-cmd",
  },
  // ── 4 bots working ──
  {
    id: "s6-p1",
    time: 2.6,
    sender: "商城_bot",
    side: "left",
    type: "progress",
    nameLabel: "商城_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (3s)\n → 🔧 Edit: payment.config.ts",
    font: "JetBrains Mono",
    phase: "s6-work",
  },
  {
    id: "s6-p2",
    time: 2.9,
    sender: "官网_bot",
    side: "left",
    type: "progress",
    nameLabel: "官网_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (2s)\n → 🔧 Edit: hero-section.tsx",
    font: "JetBrains Mono",
    phase: "s6-work",
  },
  {
    id: "s6-p3",
    time: 3.2,
    sender: "小程序_bot",
    side: "left",
    type: "progress",
    nameLabel: "小程序_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (4s)\n → 🔧 Read: components/*.tsx",
    font: "JetBrains Mono",
    phase: "s6-work",
  },
  {
    id: "s6-p4",
    time: 3.4,
    sender: "活动_bot",
    side: "left",
    type: "progress",
    nameLabel: "活动_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (2s)\n → 🔧 Write: ab-test-plan.md",
    font: "JetBrains Mono",
    phase: "s6-work",
  },
  // ── 4 results ──
  {
    id: "s6-r1",
    time: 4.5,
    sender: "商城_bot",
    side: "left",
    type: "result",
    nameLabel: "商城_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 超时已改为 60s + 添加 3 次重试逻辑，单元测试通过",
    font: "Inter",
    phase: "s6-result",
  },
  {
    id: "s6-r2",
    time: 5.0,
    sender: "官网_bot",
    side: "left",
    type: "result",
    nameLabel: "官网_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ Hero 文案已更新为春季版，CTA 按钮和副标题同步调整",
    font: "Inter",
    phase: "s6-result",
  },
  {
    id: "s6-r3",
    time: 5.4,
    sender: "小程序_bot",
    side: "left",
    type: "result",
    nameLabel: "小程序_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 暗黑模式已适配 12 个新组件，色值和间距对齐设计稿",
    font: "Inter",
    phase: "s6-result",
  },
  {
    id: "s6-r4",
    time: 5.8,
    sender: "活动_bot",
    side: "left",
    type: "result",
    nameLabel: "活动_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ A/B 测试方案已生成：3 组变量 × 2 个转化指标，预计 7 天出结果",
    font: "Inter",
    phase: "s6-result",
  },
  // ── Follow-up commands ──
  {
    id: "s6-c5",
    time: 6.5,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@商城_bot 顺便把错误提示也优化一下",
    font: "Inter",
    phase: "s6-followup",
  },
  {
    id: "s6-c6",
    time: 7.0,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@活动_bot 方案加一个社交裂变的变量",
    font: "Inter",
    phase: "s6-followup",
  },
  {
    id: "s6-p5",
    time: 7.8,
    sender: "商城_bot",
    side: "left",
    type: "progress",
    nameLabel: "商城_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (2s)\n → 🔧 Edit: payment-error.tsx",
    font: "JetBrains Mono",
    phase: "s6-work2",
  },
  {
    id: "s6-p6",
    time: 8.2,
    sender: "活动_bot",
    side: "left",
    type: "progress",
    nameLabel: "活动_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#E8EDF2",
    textColor: "#505055",
    content: "⚙️ working... (1s)\n → 🔧 Edit: ab-test-plan.md",
    font: "JetBrains Mono",
    phase: "s6-work2",
  },
  {
    id: "s6-r5",
    time: 9.2,
    sender: "商城_bot",
    side: "left",
    type: "result",
    nameLabel: "商城_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 错误提示已优化为用户友好文案，支持中英文",
    font: "Inter",
    phase: "s6-result2",
  },
  {
    id: "s6-r6",
    time: 9.6,
    sender: "活动_bot",
    side: "left",
    type: "result",
    nameLabel: "活动_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 已添加社交裂变变量，方案更新为 4 组 × 2 指标",
    font: "Inter",
    phase: "s6-result2",
  },
  // ── Mic drop ──
  {
    id: "s6-done",
    time: 10.5,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "完美 👏",
    font: "Inter",
    phase: "s6-done",
  },
];

const MOMENT_B_BUBBLES = SCENE4_BUBBLES.map((b) => ({
  ...b,
  time: MOMENT_B_START + b.time * MOMENT_B_PACE,
}));
const MOMENT_B_POS = computePositions(MOMENT_B_BUBBLES);

// ══════════════════════════════════════════
// Overlay text — large, centered, semi-transparent background
// ══════════════════════════════════════════
const OverlayText: React.FC<{ text: string; opacity: number }> = ({
  text,
  opacity,
}) => {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 100,
        left: 40,
        right: 40,
        display: "flex",
        justifyContent: "center",
        opacity,
        zIndex: 10,
      }}
    >
      <div
        style={{
          padding: "16px 36px",
          borderRadius: 20,
          backgroundColor: "rgba(0,0,0,0.75)",
          backdropFilter: "blur(12px)",
        }}
      >
        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: 32,
            fontWeight: 700,
            color: "#FFFFFF",
            letterSpacing: "-0.01em",
          }}
        >
          {text}
        </span>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════
// Scene 6: Product Introduction
//
// 0-2s:    "Claude Code 用户都有一个问题。"
// 2-4s:    "多项目 = 多终端 = 碎片化。"
// 4-6s:    "如果所有项目，都在一个 IM 群里？"
// 6-10s:   Scene1 team chat + overlay "任务·进度·结果·讨论，同一条时间线"
// 10-13s:  Scene4 solo command + overlay "@mention 路由，多项目零切换"
// 13-15s:  "一个进程，后台常驻，永不掉线。"
// 15-17s:  "独立短进程，上下文不膨胀。"
// 17-19s:  "项目记忆持久化，重启不失忆。"
// 19-22s:  CTA
// 22-25s:  GitHub
// ══════════════════════════════════════════

export const Scene6_ProductIntro: React.FC = () => {
  const frame = useCurrentFrame();
  const { chat } = CONFIG;
  const chatLeft = (W - chat.width) / 2;

  // ── Moment A: team chat (6-15s) ──
  const momentAOp = interpolate(frame, [sec(6), sec(6.15)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const momentAOut = interpolate(frame, [sec(15.3), sec(15.45)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showA = frame >= sec(5.9) && frame < sec(15.8);

  const overlayAOp = interpolate(
    frame,
    [sec(7.5), sec(7.8), sec(14.8), sec(15.2)],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── Moment B: solo command (16-24s) ──
  const momentBOp = interpolate(frame, [sec(16), sec(16.15)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const momentBOut = interpolate(frame, [sec(23.8), sec(23.95)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showB = frame >= sec(15.9) && frame < sec(24.2);

  const overlayBOp = interpolate(
    frame,
    [sec(17.5), sec(17.8), sec(23.3), sec(23.7)],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* ── Text card 1: Hook ── */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "Claude Code", color: "#007AFF" },
              { text: " 用户" },
            ],
            fontSize: 80,
          },
          { text: "都有一个问题。", fontSize: 80 },
        ]}
        startTime={0.2}
        fadeOutTime={1.8}
        lineDelay={18}
      />

      {/* ── Text card 2: Problem ── */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "多项目", color: "#007AFF" },
              { text: " = 多终端" },
            ],
            fontSize: 80,
          },
          {
            segments: [
              { text: "= " },
              { text: "碎片化", color: "#007AFF" },
              { text: "。" },
            ],
            fontSize: 80,
          },
        ]}
        startTime={2.2}
        fadeOutTime={3.8}
        lineDelay={18}
      />

      {/* ── Text card 3: Solution tease ── */}
      <AppleTextCard
        lines={[
          { text: "如果所有项目，", fontSize: 72 },
          { text: "都在一个", fontSize: 72 },
          {
            segments: [{ text: "IM 群", color: "#007AFF" }, { text: "里？" }],
            fontSize: 72,
          },
        ]}
        startTime={4.2}
        fadeOutTime={5.8}
        lineDelay={16}
      />

      {/* ── Moment A: Team collaboration (Scene 1 data) ── */}
      {showA && (
        <div style={{ opacity: momentAOp * momentAOut }}>
          <Camera positions={MOMENT_A_POS}>
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
                <ChatHeader />
                <div style={{ padding: "0" }}>
                  <MessageList bubbles={MOMENT_A_BUBBLES} />
                </div>
              </div>
            </GlassBackground>
          </Camera>
          <OverlayText
            text="任务 · 进度 · 结果 · 讨论，同一条时间线"
            opacity={overlayAOp}
          />
        </div>
      )}

      {/* ── Moment B: Solo multi-project (Scene 4 data) ── */}
      {showB && (
        <div style={{ opacity: momentBOp * momentBOut }}>
          <Camera positions={MOMENT_B_POS}>
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
                <ChatHeader />
                <div style={{ padding: "0" }}>
                  <MessageList bubbles={MOMENT_B_BUBBLES} />
                </div>
              </div>
            </GlassBackground>
          </Camera>
          <OverlayText
            text="@mention 路由，多项目零切换"
            opacity={overlayBOp}
          />
        </div>
      )}

      {/* ── Text card 4: Always online ── */}
      <AppleTextCard
        lines={[
          {
            segments: [{ text: "一个进程", color: "#007AFF" }, { text: "，" }],
            fontSize: 80,
          },
          { text: "后台常驻，", fontSize: 80 },
          {
            segments: [{ text: "永不掉线", color: "#007AFF" }, { text: "。" }],
            fontSize: 80,
          },
        ]}
        startTime={24.2}
        fadeOutTime={25.8}
        lineDelay={14}
      />

      {/* ── Text card 5: Context ── */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "独立短进程", color: "#007AFF" },
              { text: "，" },
            ],
            fontSize: 72,
          },
          { text: "上下文不膨胀。", fontSize: 72 },
        ]}
        startTime={26.2}
        fadeOutTime={27.8}
        lineDelay={14}
      />

      {/* ── Text card 6: Memory ── */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "项目记忆", color: "#007AFF" },
              { text: "持久化，" },
            ],
            fontSize: 72,
          },
          { text: "重启不失忆。", fontSize: 72 },
        ]}
        startTime={28.2}
        fadeOutTime={29.8}
        lineDelay={14}
      />

      {/* ── CTA ── */}
      <AppleTextCard
        lines={[
          { text: "来认识一下可能是目前", fontSize: 56, color: "#8E8E93" },
          {
            segments: [
              { text: "最佳的 " },
              { text: "Claude Code", color: "#007AFF" },
            ],
            fontSize: 72,
          },
          { text: "远程解决方案。🚢", fontSize: 72 },
        ]}
        startTime={30.2}
        fadeOutTime={32.5}
        lineDelay={18}
      />

      {/* ── GitHub card ── */}
      <GitHubCard startTime={33} />
    </AbsoluteFill>
  );
};
