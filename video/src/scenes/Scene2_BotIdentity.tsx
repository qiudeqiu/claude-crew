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
import { GitHubCard, ProjectBadge } from "../components/GitHubCard";

const FPS = CONFIG.fps;
const W = CONFIG.canvas.width;
const H = CONFIG.canvas.height;

// ══════════════════════════════════════════
// Phase 1: Master bot menu flow messages
// ══════════════════════════════════════════

interface MenuMsg {
  role: "user" | "bot";
  text: string;
  /** Render inline button grid */
  buttons?: string[][];
  /** Highlight a specific button */
  highlight?: string;
  /** Show as a success message */
  isSuccess?: boolean;
}

const MENU_MSGS: MenuMsg[] = [
  { role: "user", text: "/menu" },
  {
    role: "bot",
    text: "🤖 Claude Crew\n━━━━━━━━━━\n🟢 3 个项目在线",
    buttons: [
      ["🤖 Bots", "⚙️ Config", "👥 Users"],
      ["📊 Status", "📋 Cron", "🔄 Restart"],
    ],
    highlight: "🤖 Bots",
  },
  {
    role: "bot",
    text: "📂 机器人列表：\n  • 修仙小说_bot 🟢\n  • 爬虫搭档_bot 🟢\n  • 股市分析_bot 🟢",
    buttons: [["➕ 添加机器人"]],
    highlight: "➕ 添加机器人",
  },
  { role: "bot", text: "请发送 Bot Token：" },
  { role: "user", text: "7891234567:AAH-xxxxx..." },
  { role: "bot", text: "✅ Found: @电商_bot\n\n项目名称？", isSuccess: true },
  { role: "user", text: "电商项目" },
  { role: "bot", text: "项目绝对路径？" },
  { role: "user", text: "~/projects/shopify-store" },
  {
    role: "bot",
    text: "✅ @电商_bot 已添加！\n📂 电商项目 → ~/projects/shopify-store",
    isSuccess: true,
    buttons: [["🔄 重启生效"]],
    highlight: "🔄 重启生效",
  },
];

// ══════════════════════════════════════════
// Phase 2: 4 demo bots (first one = 电商_bot)
// ══════════════════════════════════════════

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
        text: "✅ 已部署到 staging，倒计时和满减逻辑都 OK，要直接推 production 吗？",
      },
      { role: "user", text: "推吧，SKU 库存也检查一下" },
      { role: "bot", text: "✅ 已推生产环境，3 个低库存 SKU 已标记预警" },
      { role: "user", text: "把预警的三个 SKU 自动下架" },
      { role: "bot", text: "✅ 已下架 3 个 SKU 并发送补货通知给供应商" },
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
        text: "✅ 大纲已生成：天劫降临→三道雷劫→金丹成型→师门震动，伏笔接第 35 章",
      },
      { role: "user", text: "天劫那段太平淡了，加点紧张感" },
      {
        role: "bot",
        text: "✅ 已重写：雷劫劈碎法宝，主角肉身硬扛第三道天雷，丹田濒临崩溃时触发隐脉",
      },
    ],
  },
  {
    name: "爬虫搭档_bot",
    path: "~/tools/data-scraper",
    color: "#00D1A0",
    emoji: "🕷️",
    messages: [
      { role: "user", text: "小红书「露营装备」热门笔记抓一下" },
      { role: "bot", text: "⚙️ 抓取中... 已获取 Top 50 笔记" },
      {
        role: "bot",
        text: "✅ 已存入 camping.csv，含标题、点赞、评论、发布时间",
      },
      { role: "user", text: "点赞过万的单独整理一份" },
      { role: "bot", text: "✅ 筛选出 8 篇万赞笔记，已导出 hot_picks.csv" },
    ],
  },
  {
    name: "股市分析_bot",
    path: "~/finance/stock-analysis",
    color: "#FF4081",
    emoji: "📈",
    messages: [
      { role: "user", text: "比亚迪近一个月走势分析一下" },
      {
        role: "bot",
        text: "✅ 月涨 +12.3%，突破 60 日线，MACD 金叉，成交量放大 40%",
      },
      { role: "user", text: "和特斯拉同期做个对比" },
      {
        role: "bot",
        text: "✅ 特斯拉同期 -3.8%，比亚迪相对强势。港股联动图表已生成",
      },
    ],
  },
];

// ══════════════════════════════════════════
// Layout constants
// ══════════════════════════════════════════

const GAP = 16;
const PX = 24;
const PANEL_W = (W - PX * 2 - GAP) / 2;
const PANEL_H = 780;
const GRID_TOP = (H - PANEL_H * 2 - GAP) / 2;

function gridPos(i: number) {
  const col = i % 2;
  const row = Math.floor(i / 2);
  return { x: PX + col * (PANEL_W + GAP), y: GRID_TOP + row * (PANEL_H + GAP) };
}

const FULL_W = W - 60;
const FULL_H = 1200;
const FULL_X = 30;
const FULL_Y = (H - FULL_H) / 2 - 40;

// ══════════════════════════════════════════
// Timeline
// ══════════════════════════════════════════

// Opening: 0-2.5s | Menu: 2.5-9s | 电商 full: 9-12.5s | Grid: 12.5-17s | Closing: 17-22s
export const SCENE2_DURATION = 26;

export const Scene2_BotIdentity: React.FC = () => {
  const frame = useCurrentFrame();
  const { chat } = CONFIG;
  const chatLeft = (W - chat.width) / 2;

  // ── Phase timing ──
  const menuStart = sec(2.5);
  const menuEnd = sec(8.5);
  const demoFullStart = sec(9);
  const shrinkStart = sec(12.5);
  const shrinkEnd = sec(13.2);
  const gridEnd = sec(17);

  // Menu chat fade
  const menuOp = interpolate(frame, [sec(2.4), sec(2.55)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const menuFadeOut = interpolate(frame, [sec(8.3), sec(8.45)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showMenu = frame >= menuStart - 5 && frame < sec(8.8);

  // Demo panels
  const shrinkProgress = interpolate(frame, [shrinkStart, shrinkEnd], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const demoOp = interpolate(frame, [sec(8.8), sec(9)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const demoFadeOut = interpolate(frame, [sec(16.8), sec(16.95)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showDemo = frame >= sec(8.8) && frame < sec(17.2);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Project badge — above text */}
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
        textBlockHeight={270}
      />

      {/* ── Opening text ── */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "找 " },
              { text: "master bot", color: "#007AFF" },
            ],
            fontSize: 80,
          },
          { text: "帮你添加 bot，", fontSize: 80 },
          {
            segments: [
              { text: "它可以成为你的" },
              { text: "项目管家", color: "#007AFF" },
              { text: "。" },
            ],
            fontSize: 64,
            color: "#8E8E93",
          },
        ]}
        startTime={0.3}
        fadeOutTime={2.3}
      />

      {/* ── Master bot menu flow ── */}
      {showMenu && (
        <div style={{ opacity: menuOp * menuFadeOut }}>
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
              {/* Master bot header */}
              <MasterHeader />
              {/* Menu messages */}
              <div
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {MENU_MSGS.map((msg, mi) => {
                  const msgFrame = menuStart + mi * 22;
                  const msgOp = interpolate(frame - msgFrame, [0, 5], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                  if (msgOp <= 0) return null;
                  return <MenuBubble key={mi} msg={msg} opacity={msgOp} />;
                })}
              </div>
            </div>
          </AbsoluteFill>
        </div>
      )}

      {/* ── Demo panels (full → grid) ── */}
      {showDemo && (
        <AbsoluteFill style={{ opacity: demoOp * demoFadeOut }}>
          {BOTS.map((bot, i) => {
            const isFirst = i === 0;
            const grid = gridPos(i);

            let pX: number, pY: number, pW: number, pH: number;
            let pOp: number, pScale: number;

            if (isFirst) {
              pX = interpolate(shrinkProgress, [0, 1], [FULL_X, grid.x]);
              pY = interpolate(shrinkProgress, [0, 1], [FULL_Y, grid.y]);
              pW = interpolate(shrinkProgress, [0, 1], [FULL_W, PANEL_W]);
              pH = interpolate(shrinkProgress, [0, 1], [FULL_H, PANEL_H]);
              pOp = 1;
              pScale = 1;
            } else {
              pX = grid.x;
              pY = grid.y;
              pW = PANEL_W;
              pH = PANEL_H;
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
              pScale = interpolate(sp, [0, 1], [0.7, 1]);
              pOp = interpolate(rel, [0, 6], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              });
            }

            const msgBase = isFirst
              ? demoFullStart + 15
              : shrinkEnd + (i - 1) * 4 + 18;
            const nameSize = isFirst
              ? interpolate(shrinkProgress, [0, 1], [32, 20])
              : 20;
            const pathSize = isFirst
              ? interpolate(shrinkProgress, [0, 1], [18, 13])
              : 13;
            const avatarSz = isFirst
              ? interpolate(shrinkProgress, [0, 1], [56, 42])
              : 42;
            const msgFont = isFirst
              ? interpolate(shrinkProgress, [0, 1], [28, 17])
              : 17;

            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: pX,
                  top: pY,
                  width: pW,
                  height: pH,
                  borderRadius: 20,
                  backgroundColor: "#FFFFFF",
                  boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
                  overflow: "hidden",
                  opacity: pOp,
                  transform: `scale(${pScale})`,
                  transformOrigin: "center center",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div style={{ height: 4, backgroundColor: bot.color }} />
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
                      width: avatarSz,
                      height: avatarSz,
                      borderRadius: "50%",
                      backgroundColor: bot.color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: avatarSz * 0.52,
                      flexShrink: 0,
                    }}
                  >
                    {bot.emoji}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span
                      style={{
                        fontFamily: fontFamilyInter,
                        fontSize: nameSize,
                        fontWeight: 700,
                        color: "#1C1C1E",
                      }}
                    >
                      {bot.name}
                    </span>
                    <span
                      style={{
                        fontFamily: fontFamilyMono,
                        fontSize: pathSize,
                        color: bot.color,
                      }}
                    >
                      {bot.path}
                    </span>
                  </div>
                </div>
                <div
                  style={{
                    flex: 1,
                    padding: "14px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    overflow: "hidden",
                  }}
                >
                  {bot.messages.map((msg, mi) => {
                    const msgFrame = msgBase + mi * 16;
                    const msgOp = interpolate(
                      frame - msgFrame,
                      [0, 5],
                      [0, 1],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
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
                            fontSize: msgFont,
                            color: isUser
                              ? "#FFF"
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

      {/* ── Closing text ── */}
      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "提供" },
              { text: "绝对路径", color: "#007AFF" },
              { text: "，" },
            ],
            fontSize: 72,
          },
          {
            text: "30s 便可创建一个项目 bot，",
            fontSize: 56,
            color: "#8E8E93",
          },
          {
            segments: [
              { text: "构建你的" },
              { text: "多项目集群", color: "#007AFF" },
            ],
            fontSize: 72,
          },
          { text: "管理系统。🤖", fontSize: 72 },
        ]}
        startTime={17.2}
        fadeOutTime={21.5}
        lineDelay={18}
      />

      {/* GitHub card at the end */}
      <GitHubCard startTime={22} />
    </AbsoluteFill>
  );
};

// ══════════════════════════════════════════
// Sub-components
// ══════════════════════════════════════════

const MasterHeader: React.FC = () => (
  <div
    style={{
      width: CONFIG.chat.width,
      height: CONFIG.chat.headerHeight,
      display: "flex",
      alignItems: "center",
      padding: "0 24px",
      gap: 16,
      background: "rgba(245, 245, 247, 0.85)",
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
        background: "linear-gradient(135deg, #007AFF, #5856D6)",
        boxShadow: "0 4px 12px rgba(0,122,255,0.3)",
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
        Master Bot
      </span>
      <span
        style={{ fontFamily: fontFamilyInter, fontSize: 22, color: "#AEAEB2" }}
      >
        claude-crew 管理中心
      </span>
    </div>
  </div>
);

const MenuBubble: React.FC<{ msg: MenuMsg; opacity: number }> = ({
  msg,
  opacity,
}) => {
  const isUser = msg.role === "user";
  const hasButtons = !!msg.buttons;
  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: isUser ? "75%" : hasButtons ? "100%" : "85%",
        width: hasButtons ? "100%" : undefined,
        opacity,
      }}
    >
      <div
        style={{
          backgroundColor: isUser
            ? "#007AFF"
            : msg.isSuccess
              ? "#E8F5E9"
              : "#F0F0F2",
          borderRadius: isUser ? "20px 20px 0 20px" : "0 20px 20px 20px",
          borderLeft: msg.isSuccess ? "3px solid #34C759" : "none",
          padding: "16px 20px",
        }}
      >
        <span
          style={{
            fontFamily: msg.role === "user" ? fontFamilyMono : fontFamilyInter,
            fontSize: 28,
            color: isUser ? "#FFF" : "#1C1C1E",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.text}
        </span>
      </div>
      {/* Inline buttons */}
      {msg.buttons && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginTop: 14,
          }}
        >
          {msg.buttons.map((row, ri) => (
            <div key={ri} style={{ display: "flex", gap: 10 }}>
              {row.map((btn, bi) => (
                <div
                  key={bi}
                  style={{
                    flex: 1,
                    padding: "14px 10px",
                    borderRadius: 14,
                    textAlign: "center",
                    backgroundColor:
                      btn === msg.highlight ? "#007AFF" : "#E8E8ED",
                    fontFamily: fontFamilyInter,
                    fontSize: 24,
                    fontWeight: 600,
                    color: btn === msg.highlight ? "#FFF" : "#1C1C1E",
                  }}
                >
                  {btn}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
