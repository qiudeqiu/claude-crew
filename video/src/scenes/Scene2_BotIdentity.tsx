import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  spring,
  interpolate,
  Easing,
} from "remotion";
import { CONFIG } from "../data/bubbles";
import { fontFamilyInter, fontFamilyMono } from "../fonts";
import { sec } from "../helpers";
import { AppleTextCard } from "../components/AppleTextCard";

const FPS = CONFIG.fps;
const W = CONFIG.canvas.width;
const H = CONFIG.canvas.height;

/** 4 bots, 4 domains, 4 colors */
const BOTS = [
  {
    name: "前端_bot",
    path: "~/projects/web-app",
    color: "#3390EC",
    emoji: "💻",
    ask: "首页加载太慢，优化一下",
    reply: "✅ 图片懒加载 + API 并发请求，LCP 从 3.2s 降到 1.1s",
  },
  {
    name: "数据_bot",
    path: "~/analytics/growth",
    color: "#A45EFF",
    emoji: "📊",
    ask: "上周的用户留存数据整理一下",
    reply: "✅ 7日留存 42%→48%，主要增长来自推送策略优化",
  },
  {
    name: "文档_bot",
    path: "~/docs/api-guide",
    color: "#00D1A0",
    emoji: "✍️",
    ask: "支付接口的文档补全一下",
    reply: "✅ 已生成完整文档，含请求示例、错误码和流程图",
  },
  {
    name: "Agent_bot",
    path: "~/agents/support",
    color: "#FF4081",
    emoji: "🤖",
    ask: "训练一个退款自动回复",
    reply: "✅ 退款 Agent 已配置，覆盖 5 种场景，准确率 94%",
  },
];

// 2x2 grid positions
const GAP = 16;
const PX = 24;
const PANEL_W = (W - PX * 2 - GAP) / 2;
const PANEL_H = 720;
const GRID_TOP = (H - PANEL_H * 2 - GAP) / 2;

function gridPos(i: number) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  return {
    x: PX + col * (PANEL_W + GAP),
    y: GRID_TOP + row * (PANEL_H + GAP),
  };
}

// Full-screen position for first bot (centered, larger)
const FULL_W = W - 60;
const FULL_H = 1200;
const FULL_X = 30;
const FULL_Y = (H - FULL_H) / 2 - 40;

/**
 * Scene 2: One Bot = Many Identities
 *
 * 0-2.5s:    Opening text
 * 2.5-5.5s:  First bot appears FULL SCREEN with ask+reply
 * 5.5-6.5s:  First bot shrinks to top-left, other 3 pop in
 * 6.5-11s:   All 4 visible, messages animate in other 3
 * 11-16s:    Closing text
 */
export const SCENE2_DURATION = 16;

export const Scene2_BotIdentity: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase timing
  const fullStart = sec(2.8); // first bot appears full-screen
  const shrinkStart = sec(5.5); // starts shrinking
  const shrinkEnd = sec(6.2); // finished shrinking, others appear

  // Shrink progress: 0 = full screen, 1 = grid position
  const shrinkProgress = interpolate(
    frame,
    [shrinkStart, shrinkEnd],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) },
  );

  // Fade out everything before closing
  const fadeOut = interpolate(frame, [sec(11), sec(11.15)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const showPanels = frame >= fullStart - 5 && frame < sec(11.5);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Opening text */}
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

      {showPanels && (
        <AbsoluteFill style={{ opacity: fadeOut }}>
          {BOTS.map((bot, i) => {
            const isFirst = i === 0;
            const grid = gridPos(i);

            // First bot: interpolate from full-screen to grid position
            // Others: appear at shrinkEnd with spring
            let panelX: number;
            let panelY: number;
            let panelW: number;
            let panelH: number;
            let panelOpacity: number;
            let panelScale: number;

            if (isFirst) {
              panelX = interpolate(shrinkProgress, [0, 1], [FULL_X, grid.x]);
              panelY = interpolate(shrinkProgress, [0, 1], [FULL_Y, grid.y]);
              panelW = interpolate(shrinkProgress, [0, 1], [FULL_W, PANEL_W]);
              panelH = interpolate(shrinkProgress, [0, 1], [FULL_H, PANEL_H]);

              const enterRel = frame - fullStart;
              panelOpacity = interpolate(enterRel, [0, 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
              panelScale = 1;
            } else {
              panelX = grid.x;
              panelY = grid.y;
              panelW = PANEL_W;
              panelH = PANEL_H;

              const enterFrame = shrinkEnd + (i - 1) * 4;
              const rel = frame - enterFrame;
              const sp =
                rel >= 0
                  ? spring({
                      fps: FPS,
                      frame: rel,
                      config: { damping: 22, stiffness: 200, overshootClamping: true },
                    })
                  : 0;
              panelScale = interpolate(sp, [0, 1], [0.7, 1]);
              panelOpacity = interpolate(rel, [0, 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
            }

            // Message timing
            const askDelay = isFirst ? fullStart + 15 : shrinkEnd + (i - 1) * 4 + 18;
            const replyDelay = askDelay + 25;
            const askOp = interpolate(frame - askDelay, [0, 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const replyOp = interpolate(frame - replyDelay, [0, 5], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });

            // Font sizes scale with panel
            const headerNameSize = isFirst
              ? interpolate(shrinkProgress, [0, 1], [32, 20])
              : 20;
            const headerPathSize = isFirst
              ? interpolate(shrinkProgress, [0, 1], [18, 13])
              : 13;
            const avatarSize = isFirst
              ? interpolate(shrinkProgress, [0, 1], [56, 42])
              : 42;
            const msgFontSize = isFirst
              ? interpolate(shrinkProgress, [0, 1], [28, 17])
              : 17;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: panelX,
                  top: panelY,
                  width: panelW,
                  height: panelH,
                  borderRadius: 20,
                  backgroundColor: "#FFFFFF",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                  overflow: "hidden",
                  opacity: panelOpacity,
                  transform: `scale(${panelScale})`,
                  transformOrigin: "center center",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Color accent bar */}
                <div style={{ height: 4, backgroundColor: bot.color }} />

                {/* Header */}
                <div
                  style={{
                    padding: "14px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    borderBottom: "1px solid rgba(0,0,0,0.05)",
                  }}
                >
                  <div
                    style={{
                      width: avatarSize,
                      height: avatarSize,
                      borderRadius: "50%",
                      backgroundColor: bot.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: avatarSize * 0.52,
                      flexShrink: 0,
                    }}
                  >
                    {bot.emoji}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontFamily: fontFamilyInter,
                        fontSize: headerNameSize,
                        fontWeight: 700,
                        color: "#1C1C1E",
                      }}
                    >
                      {bot.name}
                    </span>
                    <span
                      style={{
                        fontFamily: fontFamilyMono,
                        fontSize: headerPathSize,
                        color: bot.color,
                      }}
                    >
                      {bot.path}
                    </span>
                  </div>
                </div>

                {/* Messages */}
                <div
                  style={{
                    flex: 1,
                    padding: "14px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                  }}
                >
                  {/* User ask */}
                  <div
                    style={{
                      alignSelf: "flex-end",
                      maxWidth: "85%",
                      backgroundColor: "#007AFF",
                      borderRadius: "16px 16px 0 16px",
                      padding: "10px 14px",
                      opacity: askOp,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: fontFamilyInter,
                        fontSize: msgFontSize,
                        color: "#FFFFFF",
                        lineHeight: 1.4,
                      }}
                    >
                      {bot.ask}
                    </span>
                  </div>

                  {/* Bot reply */}
                  <div
                    style={{
                      alignSelf: "flex-start",
                      maxWidth: "85%",
                      backgroundColor: "#E8F5E9",
                      borderLeft: "3px solid #34C759",
                      borderRadius: "0 16px 16px 16px",
                      padding: "10px 14px",
                      opacity: replyOp,
                    }}
                  >
                    <span
                      style={{
                        fontFamily: fontFamilyInter,
                        fontSize: msgFontSize,
                        color: "#1C1C1E",
                        lineHeight: 1.4,
                      }}
                    >
                      {bot.reply}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </AbsoluteFill>
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
        startTime={11.5}
      />
    </AbsoluteFill>
  );
};
