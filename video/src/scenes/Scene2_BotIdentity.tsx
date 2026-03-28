import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { CONFIG } from "../data/bubbles";
import type { Bubble } from "../data/bubbles";
import { sec, computePositions } from "../helpers";
import { ChatHeader } from "../components/ChatHeader";
import { MessageList } from "../components/MessageList";
import { Camera } from "../components/Camera";
import { AppleTextCard } from "../components/AppleTextCard";

/**
 * Scene 2 chat data — one bot, many roles.
 * Same bot "@项目_bot" handles code review, writing, debugging, teaching.
 * Shows versatility + continuous memory.
 */
const SCENE2_BUBBLES: Bubble[] = [
  // User asks for code review
  {
    id: "s2-1",
    time: 0.3,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@项目_bot review 一下刚提交的 PR",
    font: "Inter",
    phase: "s2",
  },
  {
    id: "s2-2",
    time: 1.2,
    sender: "项目_bot",
    side: "left",
    type: "result",
    nameLabel: "项目_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 已审查 3 个文件，发现 1 个潜在问题：auth.ts:42 缺少 token 过期校验，建议添加 refresh 逻辑",
    font: "Inter",
    phase: "s2",
  },
  // User asks for writing
  {
    id: "s2-3",
    time: 2.8,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@项目_bot 给这个功能写一份用户文档",
    font: "Inter",
    phase: "s2",
  },
  {
    id: "s2-4",
    time: 3.8,
    sender: "项目_bot",
    side: "left",
    type: "result",
    nameLabel: "项目_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 文档已生成到 docs/auth-flow.md，包含流程图、配置说明和常见问题",
    font: "Inter",
    phase: "s2",
  },
  // User asks about architecture — bot remembers context
  {
    id: "s2-5",
    time: 5.2,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@项目_bot 新人入职，帮我整理一份架构说明",
    font: "Inter",
    phase: "s2",
  },
  {
    id: "s2-6",
    time: 6.3,
    sender: "项目_bot",
    side: "left",
    type: "result",
    nameLabel: "项目_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 已生成架构说明：前端 React + 后端 Express + 数据库 PostgreSQL，含模块依赖图和 API 清单",
    font: "Inter",
    phase: "s2",
  },
  // User asks to fix bug — bot remembers the auth issue it found
  {
    id: "s2-7",
    time: 7.6,
    sender: "you",
    side: "right",
    type: "message",
    nameColor: "",
    bubbleColor: "#007AFF",
    textColor: "#FFFFFF",
    content: "@项目_bot 刚才 review 发现的那个 token 问题，直接修掉",
    font: "Inter",
    phase: "s2",
  },
  {
    id: "s2-8",
    time: 8.8,
    sender: "项目_bot",
    side: "left",
    type: "result",
    nameLabel: "项目_bot",
    nameColor: "#7A7A80",
    bubbleColor: "#F0F0F2",
    textColor: "#1C1C1E",
    content: "✅ 已修复 auth.ts:42，添加了 token refresh 逻辑 + 过期重试，5 个测试全部通过",
    font: "Inter",
    phase: "s2",
  },
];

// Offset for chat timeline (appears after opening text)
const CHAT_START = 3.0;
const PACE = 0.65;

const OFFSET_BUBBLES = SCENE2_BUBBLES.map((b) => ({
  ...b,
  time: CHAT_START + b.time * PACE,
}));

const POSITIONS = computePositions(OFFSET_BUBBLES);

// Custom header for this scene — single bot, not a group
const SCENE2_HEADER = {
  ...CONFIG.header,
  title: "项目_bot",
  subtitle: "绑定目录: /projects/my-app",
};

/**
 * Scene 2: One Bot = Many Identities
 *
 * 0-2.8s:    Opening text (Apple style, 2 lines max)
 * 2.8-11s:   Chat — same bot handles review, docs, architecture, bugfix
 * 11-15s:    Closing text
 */
export const SCENE2_DURATION = 15;

export const Scene2_BotIdentity: React.FC = () => {
  const frame = useCurrentFrame();
  const { canvas, chat } = CONFIG;
  const chatLeft = (canvas.width - chat.width) / 2;

  const chatOpacity = interpolate(frame, [sec(2.7), sec(2.85)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const chatFadeOut = interpolate(frame, [sec(10.5), sec(10.65)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showChat = frame >= sec(2.6) && frame < sec(11);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Opening text — Apple minimal: 2 big lines */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "一个 " },
              { text: "bot", color: "#007AFF" },
              { text: "，" },
            ],
            fontSize: 96,
          },
          {
            segments: [
              { text: "可以是" },
              { text: "一切", color: "#007AFF" },
              { text: "。" },
            ],
            fontSize: 96,
          },
        ]}
        startTime={0.3}
        fadeOutTime={2.5}
      />

      {/* Chat — same bot, different tasks */}
      {showChat && (
        <div style={{ opacity: chatOpacity * chatFadeOut }}>
          <Camera positions={POSITIONS}>
            <AbsoluteFill
              style={{
                background:
                  "linear-gradient(180deg, #F5F5F7 0%, #ECECEE 100%)",
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
                {/* Custom header showing single bot + path */}
                <Scene2Header />
                <div style={{ padding: "0" }}>
                  <MessageList bubbles={OFFSET_BUBBLES} />
                </div>
              </div>
            </AbsoluteFill>
          </Camera>
        </div>
      )}

      {/* Closing text */}
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
          { text: "它一定坚守岗位。🤖", fontSize: 80 },
        ]}
        startTime={11}
      />
    </AbsoluteFill>
  );
};

/** Custom header for Scene 2 — shows bot name + bound directory */
import { fontFamilyInter } from "../fonts";
import { fontFamilyMono } from "../fonts";

const Scene2Header: React.FC = () => {
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
        background: "rgba(245, 245, 247, 0.85)",
        backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        borderRadius: "24px 24px 0 0",
      }}
    >
      {/* Bot avatar */}
      <div
        style={{
          width: 76,
          height: 76,
          borderRadius: "50%",
          background: "#007AFF",
          boxShadow: "0 4px 12px rgba(0,122,255,0.3)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 36,
          flexShrink: 0,
          position: "relative",
        }}
      >
        <span>🤖</span>
        <div
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: 24,
            height: 24,
            borderRadius: "50%",
            backgroundColor: "#34C759",
            border: "3px solid #FFFFFF",
          }}
        />
      </div>

      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: 36,
            fontWeight: 700,
            color: "#1C1C1E",
            lineHeight: 1.2,
          }}
        >
          项目_bot
        </span>
        <span
          style={{
            fontFamily: fontFamilyMono,
            fontSize: 20,
            color: "#007AFF",
            lineHeight: 1.3,
          }}
        >
          ~/projects/my-app
        </span>
      </div>
    </div>
  );
};
