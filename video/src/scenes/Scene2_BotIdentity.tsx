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

/** 4 bots, 4 wildly different domains */
interface BotMsg {
  role: "user" | "bot";
  text: string;
}
interface BotDef {
  name: string;
  path: string;
  color: string;
  emoji: string;
  messages: BotMsg[];
}

const BOTS: BotDef[] = [
  {
    name: "电商_bot",
    path: "~/projects/shopify-store",
    color: "#3390EC",
    emoji: "🛍️",
    messages: [
      { role: "user", text: "双十一活动页上线了吗" },
      {
        role: "bot",
        text: "✅ 已部署到 staging，倒计时组件和满减逻辑都 OK，要我直接推 production 吗？",
      },
      { role: "user", text: "推吧，顺便把 SKU 库存同步检查一下" },
      {
        role: "bot",
        text: "✅ 已推生产环境 + 库存校验通过，3 个低库存 SKU 已标记预警",
      },
    ],
  },
  {
    name: "修仙小说_bot",
    path: "~/writing/xianxia-novel",
    color: "#A45EFF",
    emoji: "📖",
    messages: [
      { role: "user", text: "第 37 章大纲写一下，主角要突破金丹期" },
      {
        role: "bot",
        text: "✅ 大纲已生成：天劫降临→三道雷劫→金丹成型→师门震动，伏笔接第 35 章的丹方线索",
      },
    ],
  },
  {
    name: "爬虫搭档_bot",
    path: "~/tools/data-scraper",
    color: "#00D1A0",
    emoji: "🕷️",
    messages: [
      { role: "user", text: "小红书上「露营装备」的热门笔记抓一下" },
      { role: "bot", text: "⚙️ 抓取中... 已获取 Top 50 笔记" },
      {
        role: "bot",
        text: "✅ 数据已存入 camping_notes.csv，含标题、点赞数、评论数、发布时间",
      },
    ],
  },
  {
    name: "股市分析_bot",
    path: "~/finance/stock-analysis",
    color: "#FF4081",
    emoji: "📈",
    messages: [
      { role: "user", text: "比亚迪近一个月的走势分析一下" },
      {
        role: "bot",
        text: "✅ 月涨幅 +12.3%，突破 60 日均线，MACD 金叉，成交量放大 40%，短期看多",
      },
    ],
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
export const SCENE2_DURATION = 17;

export const Scene2_BotIdentity: React.FC = () => {
  const frame = useCurrentFrame();

  // Phase timing
  const fullStart = sec(2.8); // first bot appears full-screen
  const shrinkStart = sec(6.0); // starts shrinking (after 4 msgs)
  const shrinkEnd = sec(6.7); // finished shrinking, others appear

  // Shrink progress: 0 = full screen, 1 = grid position
  const shrinkProgress = interpolate(frame, [shrinkStart, shrinkEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });

  // Fade out everything before closing
  const fadeOut = interpolate(frame, [sec(12), sec(12.15)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const showPanels = frame >= fullStart - 5 && frame < sec(12.5);

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
                      config: {
                        damping: 22,
                        stiffness: 200,
                        overshootClamping: true,
                      },
                    })
                  : 0;
              panelScale = interpolate(sp, [0, 1], [0.7, 1]);
              panelOpacity = interpolate(rel, [0, 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
            }

            // Message timing — stagger each message 20 frames apart
            const msgBaseFrame = isFirst
              ? fullStart + 15
              : shrinkEnd + (i - 1) * 4 + 18;

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
                    gap: 10,
                    overflow: "hidden",
                  }}
                >
                  {bot.messages.map((msg, mi) => {
                    const msgFrame = msgBaseFrame + mi * 20;
                    const msgOp = interpolate(
                      frame - msgFrame,
                      [0, 5],
                      [0, 1],
                      {
                        extrapolateLeft: "clamp",
                        extrapolateRight: "clamp",
                      },
                    );
                    const isUser = msg.role === "user";
                    const isProgress = msg.text.startsWith("⚙️");

                    return (
                      <div
                        key={mi}
                        style={{
                          alignSelf: isUser ? "flex-end" : "flex-start",
                          maxWidth: "88%",
                          backgroundColor: isUser
                            ? "#007AFF"
                            : isProgress
                              ? "#F0F0F2"
                              : "#E8F5E9",
                          borderLeft:
                            !isUser && !isProgress
                              ? "3px solid #34C759"
                              : "none",
                          borderRadius: isUser
                            ? "16px 16px 0 16px"
                            : "0 16px 16px 16px",
                          padding: "9px 13px",
                          opacity: msgOp,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: fontFamilyInter,
                            fontSize: msgFontSize,
                            color: isUser
                              ? "#FFFFFF"
                              : isProgress
                                ? "#6B6B70"
                                : "#1C1C1E",
                            lineHeight: 1.4,
                          }}
                        >
                          {msg.text}
                        </span>
                      </div>
                    );
                  })}
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
        startTime={12.5}
      />
    </AbsoluteFill>
  );
};
