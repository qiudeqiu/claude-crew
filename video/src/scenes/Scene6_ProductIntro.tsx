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
  const isSuccess = msg.isSuccess ?? msg.text.startsWith("\u2705");

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
  { role: "user", text: "@\u5546\u57CE_bot \u652F\u4ED8\u8D85\u65F6\u6539\u6210 60s" },
  { role: "user", text: "@\u5B98\u7F51_bot hero \u6587\u6848\u6362\u6625\u5B63\u7248" },
  { role: "user", text: "@\u5C0F\u7A0B\u5E8F_bot \u9002\u914D\u6697\u9ED1\u6A21\u5F0F" },
  {
    role: "bot",
    text: "\u2705 \u8D85\u65F6\u5DF2\u4FEE\u6539\uFF0C\u6D4B\u8BD5\u901A\u8FC7",
    nameLabel: "\u5546\u57CE_bot",
    isSuccess: true,
  },
  {
    role: "bot",
    text: "\u2705 \u6587\u6848\u5DF2\u66F4\u65B0",
    nameLabel: "\u5B98\u7F51_bot",
    isSuccess: true,
  },
  {
    role: "bot",
    text: "\u2705 12 \u4E2A\u7EC4\u4EF6\u5DF2\u9002\u914D",
    nameLabel: "\u5C0F\u7A0B\u5E8F_bot",
    isSuccess: true,
  },
];

// ══════════════════════════════════════════
// Moment 2: Team collaboration
// ══════════════════════════════════════════

const MOMENT2_MSGS: SimpleBubble[] = [
  {
    role: "user",
    text: "@\u5546\u57CE_bot \u652F\u4ED8\u63A5\u53E3\u52A0\u4E2A\u91CD\u8BD5\u903B\u8F91",
    nameLabel: "Leo",
  },
  {
    role: "user",
    text: "@\u5B98\u7F51_bot \u843D\u5730\u9875\u6587\u6848\u6362\u6210\u4E94\u4E00\u6D3B\u52A8\u7684",
    nameLabel: "Nova",
  },
  {
    role: "bot",
    text: "\u2705 \u5DF2\u6DFB\u52A0 retry\uFF0C3 \u4E2A\u6D4B\u8BD5\u901A\u8FC7",
    nameLabel: "\u5546\u57CE_bot",
    isSuccess: true,
  },
  {
    role: "user",
    text: "\u5B98\u7F51\u7684 banner \u6211\u505A\u597D\u4E86\uFF0C\u7B49\u4F1A\u513F\u53D1",
    nameLabel: "Momo",
  },
  {
    role: "bot",
    text: "\u2705 \u6587\u6848\u5DF2\u66F4\u65B0\uFF0CCTA \u540C\u6B65\u8C03\u6574",
    nameLabel: "\u5B98\u7F51_bot",
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
    text: "\uD83E\uDD16 Claude Crew\n\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\n\uD83D\uDFE2 3 \u4E2A\u9879\u76EE\u5728\u7EBF",
    buttons: [
      ["\uD83E\uDD16 Bots", "\u2699\uFE0F Config"],
      ["\uD83D\uDCCA Status", "\uD83D\uDD04 Restart"],
    ],
    highlight: "\uD83E\uDD16 Bots",
  },
  {
    role: "bot",
    text: "\u2705 @\u7535\u5546_bot \u5DF2\u6DFB\u52A0\uFF01\n\uD83D\uDCC2 \u7535\u5546\u9879\u76EE \u2192 ~/projects/shop",
    isSuccess: true,
    buttons: [["\uD83D\uDD04 \u91CD\u542F\u751F\u6548"]],
    highlight: "\uD83D\uDD04 \u91CD\u542F\u751F\u6548",
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
              { text: "\u53EA\u9700" },
              { text: "\u4E00\u4E2A\u8FDB\u7A0B", color: "#007AFF" },
              { text: " + " },
              { text: "\u4E00\u4E2A bot", color: "#007AFF" },
              { text: "\uFF0C" },
            ],
            fontSize: 72,
          },
          {
            text: "\u4F60\u5C06\u62E5\u6709\u6C38\u4E0D\u6389\u7EBF\u7684",
            fontSize: 56,
            color: "#8E8E93",
          },
          {
            segments: [{ text: "Claude Code", color: "#007AFF" }],
            fontSize: 72,
          },
          { text: "\u591A\u9879\u76EE\u8FDC\u7A0B\u96C6\u7FA4\u7BA1\u7406\u7CFB\u7EDF\u3002", fontSize: 72 },
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
                title="\u6211\u7684\u9879\u76EE\u7FA4"
                subtitle="\u5546\u57CE_bot, \u5B98\u7F51_bot, \u5C0F\u7A0B\u5E8F_bot"
                avatarText="\uD83D\uDCBC"
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
              text="\u4E00\u4E2A\u7FA4 @mention\uFF0C\u591A\u9879\u76EE\u5E76\u884C"
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
              text="\u5168\u5458\u540C\u4E00\u6761\u65F6\u95F4\u7EBF"
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
                subtitle="claude-crew \u7BA1\u7406\u4E2D\u5FC3"
                avatarText="\uD83D\uDC51"
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
              text="\u624B\u673A 30s \u5F00\u65B0\u9879\u76EE"
              opacity={pill3Op}
            />
          </GlassBackground>
        </div>
      )}

      {/* ── Closing text (16-20s) ── */}
      <AppleTextCard
        lines={[
          {
            text: "\u6765\u8BA4\u8BC6\u4E00\u4E0B\u53EF\u80FD\u662F\u76EE\u524D",
            fontSize: 56,
            color: "#8E8E93",
          },
          {
            segments: [
              { text: "\u6700\u4F73\u7684 " },
              { text: "Claude Code", color: "#007AFF" },
            ],
            fontSize: 72,
          },
          { text: "\u8FDC\u7A0B\u89E3\u51B3\u65B9\u6848\u3002\uD83D\uDEA2", fontSize: 72 },
        ]}
        startTime={16.5}
        fadeOutTime={20}
      />

      {/* ── GitHub card (20-25s) ── */}
      <GitHubCard startTime={20.5} />
    </AbsoluteFill>
  );
};
