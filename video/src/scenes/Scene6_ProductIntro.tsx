import React from "react";
import {
  AbsoluteFill,
  useCurrentFrame,
  interpolate,
  Easing,
} from "remotion";
import { CONFIG } from "../data/bubbles";
import { fontFamilyInter, fontFamilyMono } from "../fonts";
import { sec } from "../helpers";
import { AppleTextCard } from "../components/AppleTextCard";
import { GitHubCard, ProjectBadge } from "../components/GitHubCard";
import { GlassBackground } from "../components/GlassBackground";

export const SCENE6_DURATION = 25;

const FPS = CONFIG.fps;
const W = CONFIG.canvas.width;
const H = CONFIG.canvas.height;

// ══════════════════════════════════════════
// Overlay pill — bottom-center text badge
// ══════════════════════════════════════════

const OverlayPill: React.FC<{ text: string; opacity: number }> = ({
  text,
  opacity,
}) => (
  <div
    style={{
      position: "absolute",
      bottom: 120,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      opacity,
    }}
  >
    <div
      style={{
        padding: "12px 32px",
        borderRadius: 24,
        backgroundColor: "rgba(255,255,255,0.95)",
        boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
      }}
    >
      <span
        style={{
          fontFamily: fontFamilyInter,
          fontSize: 28,
          fontWeight: 600,
          color: "#1C1C1E",
        }}
      >
        {text}
      </span>
    </div>
  </div>
);

// ══════════════════════════════════════════
// Chat container style (reused across moments)
// ══════════════════════════════════════════

const chatContainerStyle: React.CSSProperties = {
  position: "absolute",
  left: (W - CONFIG.chat.width) / 2,
  top: 20,
  width: CONFIG.chat.width,
  background: "rgba(255,255,255,0.72)",
  backdropFilter: "blur(40px) saturate(1.8)",
  WebkitBackdropFilter: "blur(40px) saturate(1.8)",
  borderRadius: 24,
  boxShadow: "0 2px 24px rgba(0,0,0,0.05), 0 0 1px rgba(0,0,0,0.08)",
  border: "1px solid rgba(255,255,255,0.6)",
  overflow: "hidden",
};

// ══════════════════════════════════════════
// Reusable inline header component
// ══════════════════════════════════════════

interface GroupHeaderProps {
  title: string;
  subtitle: string;
  avatarText: string;
  gradient: string;
  shadowColor: string;
}

const GroupHeader: React.FC<GroupHeaderProps> = ({
  title,
  subtitle,
  avatarText,
  gradient,
  shadowColor,
}) => (
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
        background: gradient,
        boxShadow: `0 4px 12px ${shadowColor}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 30,
        fontWeight: 700,
        color: "#fff",
        fontFamily: fontFamilyInter,
        flexShrink: 0,
      }}
    >
      {avatarText}
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
        {title}
      </span>
      <span
        style={{
          fontFamily: fontFamilyInter,
          fontSize: 22,
          color: "#AEAEB2",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {subtitle}
      </span>
    </div>
  </div>
);

// ══════════════════════════════════════════
// Simple chat bubble
// ══════════════════════════════════════════

interface SimpleBubble {
  role: "user" | "bot";
  text: string;
  nameLabel?: string;
  botName?: string;
  isSuccess?: boolean;
}

const ChatBubbleInline: React.FC<{
  msg: SimpleBubble;
  opacity: number;
  fontSize?: number;
}> = ({ msg, opacity, fontSize = 28 }) => {
  const isUser = msg.role === "user";
  const isSuccess = msg.isSuccess ?? msg.text.startsWith("✅");

  return (
    <div
      style={{
        alignSelf: isUser ? "flex-end" : "flex-start",
        maxWidth: "85%",
        opacity,
      }}
    >
      {!isUser && msg.nameLabel && (
        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: 20,
            fontWeight: 600,
            color: "#7A7A80",
            marginBottom: 4,
            display: "block",
          }}
        >
          {msg.nameLabel}
        </span>
      )}
      <div
        style={{
          backgroundColor: isUser
            ? "#007AFF"
            : isSuccess
              ? "#E8F5E9"
              : "#F0F0F2",
          borderRadius: isUser ? "20px 20px 0 20px" : "0 20px 20px 20px",
          borderLeft: isSuccess ? "3px solid #34C759" : "none",
          padding: "12px 18px",
        }}
      >
        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize,
            color: isUser ? "#FFF" : "#1C1C1E",
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
          }}
        >
          {msg.text}
        </span>
      </div>
    </div>
  );
};

// ══════════════════════════════════════════
// Menu bubble (reused from Scene2 pattern)
// ══════════════════════════════════════════

interface MenuMsg {
  role: "user" | "bot";
  text: string;
  buttons?: string[][];
  highlight?: string;
  isSuccess?: boolean;
}

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

// ══════════════════════════════════════════
// Moment 1: Solo multi-project command
// ══════════════════════════════════════════

const MOMENT1_MSGS: SimpleBubble[] = [
  { role: "user", text: "@商城_bot 支付超时改成 60s" },
  { role: "user", text: "@官网_bot hero 文案换春季版" },
  { role: "user", text: "@小程序_bot 适配暗黑模式" },
  {
    role: "bot",
    text: "✅ 超时已修改，测试通过",
    nameLabel: "商城_bot",
    isSuccess: true,
  },
  {
    role: "bot",
    text: "✅ 文案已更新",
    nameLabel: "官网_bot",
    isSuccess: true,
  },
  {
    role: "bot",
    text: "✅ 12 个组件已适配",
    nameLabel: "小程序_bot",
    isSuccess: true,
  },
];

// ══════════════════════════════════════════
// Moment 2: Team collaboration
// ══════════════════════════════════════════

const MOMENT2_MSGS: SimpleBubble[] = [
  {
    role: "user",
    text: "@商城_bot 支付接口加个重试逻辑",
    nameLabel: "Leo",
  },
  {
    role: "user",
    text: "@官网_bot 落地页文案换成五一活动的",
    nameLabel: "Nova",
  },
  {
    role: "bot",
    text: "✅ 已添加 retry，3 个测试通过",
    nameLabel: "商城_bot",
    isSuccess: true,
  },
  {
    role: "user",
    text: "官网的 banner 我做好了，等会儿发",
    nameLabel: "Momo",
  },
  {
    role: "bot",
    text: "✅ 文案已更新，CTA 同步调整",
    nameLabel: "官网_bot",
    isSuccess: true,
  },
];

// ══════════════════════════════════════════
// Moment 3: Master bot menu flow
// ══════════════════════════════════════════

const MOMENT3_MSGS: MenuMsg[] = [
  { role: "user", text: "/menu" },
  {
    role: "bot",
    text: "🤖 Claude Crew\n━━━━━━━━━━\n🟢 3 个项目在线",
    buttons: [
      ["🤖 Bots", "⚙️ Config"],
      ["📊 Status", "🔄 Restart"],
    ],
    highlight: "🤖 Bots",
  },
  {
    role: "bot",
    text: "✅ @电商_bot 已添加！\n📂 电商项目 → ~/projects/shop",
    isSuccess: true,
    buttons: [["🔄 重启生效"]],
    highlight: "🔄 重启生效",
  },
];

// ══════════════════════════════════════════
// Main scene component
// ══════════════════════════════════════════

export const Scene6_ProductIntro: React.FC = () => {
  const frame = useCurrentFrame();

  // ── Moment 1 timing (3-7s) ──
  const m1FadeIn = interpolate(frame, [sec(2.8), sec(2.95)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const m1FadeOut = interpolate(frame, [sec(6.8), sec(6.95)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showM1 = frame >= sec(2.7) && frame < sec(7.2);

  // ── Moment 2 timing (7-12s) ──
  const m2FadeIn = interpolate(frame, [sec(7.0), sec(7.15)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const m2FadeOut = interpolate(frame, [sec(11.8), sec(11.95)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showM2 = frame >= sec(6.9) && frame < sec(12.2);

  // ── Moment 3 timing (12-16s) ──
  const m3FadeIn = interpolate(frame, [sec(12.0), sec(12.15)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const m3FadeOut = interpolate(frame, [sec(15.8), sec(15.95)], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const showM3 = frame >= sec(11.9) && frame < sec(16.2);

  // ── Pill opacities (synced with each moment) ──
  const pill1Op = interpolate(
    frame,
    [sec(3.5), sec(3.65), sec(6.5), sec(6.65)],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pill2Op = interpolate(
    frame,
    [sec(7.5), sec(7.65), sec(11.5), sec(11.65)],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const pill3Op = interpolate(
    frame,
    [sec(12.5), sec(12.65), sec(15.5), sec(15.65)],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  // ── Message stagger base frames ──
  const m1Base = sec(3.0);
  const m2Base = sec(7.2);
  const m3Base = sec(12.2);

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* ── Opening: ProjectBadge + text (0-3s) ── */}
      <ProjectBadge
        opacity={interpolate(
          frame,
          [0, sec(0.2), sec(2.5), sec(2.7)],
          [0, 1, 1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        )}
        textBlockHeight={300}
      />

      <AppleTextCard
        lines={[
          {
            segments: [
              { text: "只需" },
              { text: "一个进程", color: "#007AFF" },
              { text: " + " },
              { text: "一个 bot", color: "#007AFF" },
              { text: "，" },
            ],
            fontSize: 72,
          },
          {
            text: "你将拥有永不掉线的",
            fontSize: 56,
            color: "#8E8E93",
          },
          {
            segments: [{ text: "Claude Code", color: "#007AFF" }],
            fontSize: 72,
          },
          { text: "多项目远程集群管理系统。", fontSize: 72 },
        ]}
        startTime={0.3}
        fadeOutTime={2.8}
      />

      {/* ── Moment 1: Solo multi-project (3-7s) ── */}
      {showM1 && (
        <div style={{ opacity: m1FadeIn * m1FadeOut }}>
          <GlassBackground>
            <div style={chatContainerStyle}>
              <GroupHeader
                title="我的项目群"
                subtitle="商城_bot, 官网_bot, 小程序_bot"
                avatarText="💼"
                gradient="linear-gradient(135deg, #FFD700, #FFA500)"
                shadowColor="rgba(255,165,0,0.3)"
              />
              <div
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                {MOMENT1_MSGS.map((msg, i) => {
                  const msgFrame = m1Base + i * 18;
                  const msgOp = interpolate(frame - msgFrame, [0, 5], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                  if (msgOp <= 0) return null;
                  return (
                    <ChatBubbleInline key={i} msg={msg} opacity={msgOp} />
                  );
                })}
              </div>
            </div>
            <OverlayPill
              text="一个群 @mention，多项目并行"
              opacity={pill1Op}
            />
          </GlassBackground>
        </div>
      )}

      {/* ── Moment 2: Team collaboration (7-12s) ── */}
      {showM2 && (
        <div style={{ opacity: m2FadeIn * m2FadeOut }}>
          <GlassBackground>
            <div style={chatContainerStyle}>
              <GroupHeader
                title="claude-crew"
                subtitle="Leo, Nova, Momo + 3 bots"
                avatarText="CC"
                gradient="linear-gradient(135deg, #007AFF, #0055CC)"
                shadowColor="rgba(0,122,255,0.3)"
              />
              <div
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 18,
                }}
              >
                {MOMENT2_MSGS.map((msg, i) => {
                  const msgFrame = m2Base + i * 20;
                  const msgOp = interpolate(frame - msgFrame, [0, 5], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                  if (msgOp <= 0) return null;

                  // Team members on left side, bot results on left too
                  const isTeamUser =
                    msg.role === "user" &&
                    msg.nameLabel !== undefined &&
                    !msg.isSuccess;

                  return (
                    <ChatBubbleInline
                      key={i}
                      msg={{
                        ...msg,
                        // Team members show on left side
                        role: isTeamUser ? "bot" : msg.role,
                      }}
                      opacity={msgOp}
                    />
                  );
                })}
              </div>
            </div>
            <OverlayPill
              text="全员同一条时间线"
              opacity={pill2Op}
            />
          </GlassBackground>
        </div>
      )}

      {/* ── Moment 3: Mobile 30s setup (12-16s) ── */}
      {showM3 && (
        <div style={{ opacity: m3FadeIn * m3FadeOut }}>
          <GlassBackground>
            <div style={chatContainerStyle}>
              <GroupHeader
                title="Master Bot"
                subtitle="claude-crew 管理中心"
                avatarText="👑"
                gradient="linear-gradient(135deg, #007AFF, #5856D6)"
                shadowColor="rgba(0,122,255,0.3)"
              />
              <div
                style={{
                  padding: "16px 20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 20,
                }}
              >
                {MOMENT3_MSGS.map((msg, i) => {
                  const msgFrame = m3Base + i * 24;
                  const msgOp = interpolate(frame - msgFrame, [0, 5], [0, 1], {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  });
                  if (msgOp <= 0) return null;
                  return <MenuBubble key={i} msg={msg} opacity={msgOp} />;
                })}
              </div>
            </div>
            <OverlayPill
              text="手机 30s 开新项目"
              opacity={pill3Op}
            />
          </GlassBackground>
        </div>
      )}

      {/* ── Closing text (16-20s) ── */}
      <AppleTextCard
        lines={[
          {
            text: "来认识一下可能是目前",
            fontSize: 56,
            color: "#8E8E93",
          },
          {
            segments: [
              { text: "最佳的 " },
              { text: "Claude Code", color: "#007AFF" },
            ],
            fontSize: 72,
          },
          { text: "远程解决方案。🚢", fontSize: 72 },
        ]}
        startTime={16.5}
        fadeOutTime={20}
      />

      {/* ── GitHub card (20-25s) ── */}
      <GitHubCard startTime={20.5} />
    </AbsoluteFill>
  );
};
