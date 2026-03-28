import React from "react";
import { useCurrentFrame, spring, interpolate } from "remotion";
import type { Bubble } from "../data/bubbles";
import { CONFIG } from "../data/bubbles";
import { fontFamilyInter, fontFamilyMono } from "../fonts";
import { sec } from "../helpers";
import { Avatar } from "./Avatar";

// Avatar config per sender
const AVATARS: Record<string, { initial: string; color: string }> = {
  you: { initial: "我", color: "#1A4D3E" },
  leo: { initial: "李", color: "#3B82F6" },
  momo: { initial: "墨", color: "#A78BFA" },
  nova: { initial: "诺", color: "#EC4899" },
  kira: { initial: "琪", color: "#F59E0B" },
  sage: { initial: "森", color: "#14B8A6" },
  商城_bot: { initial: "🛒", color: "#10B981" },
  官网_bot: { initial: "🌐", color: "#3B82F6" },
  小程序_bot: { initial: "📱", color: "#F59E0B" },
  活动_bot: { initial: "🎉", color: "#EC4899" },
};

// Tool colors for progress bubbles
const TOOL_COLORS: Record<string, string> = {
  Read: "#3B82F6",
  Edit: "#F59E0B",
  Write: "#F59E0B",
  Bash: "#8B5CF6",
  Grep: "#EC4899",
};

/** Render content with @mention highlights and tool name coloring */
function renderRichContent(
  content: string,
  type: string,
  isRight: boolean,
): React.ReactNode {
  if (type === "progress") {
    // Color tool names: "Read:", "Edit:", etc.
    return content.split("\n").map((line, i) => {
      const toolMatch = line.match(/🔧\s*(Read|Edit|Write|Bash|Grep):/);
      if (toolMatch) {
        const toolName = toolMatch[1];
        const color = TOOL_COLORS[toolName] || "#6B7280";
        const idx = line.indexOf(toolName);
        return (
          <React.Fragment key={i}>
            {i > 0 && "\n"}
            {line.slice(0, idx)}
            <span style={{ color, fontWeight: 600 }}>{toolName}</span>
            {line.slice(idx + toolName.length)}
          </React.Fragment>
        );
      }
      return (
        <React.Fragment key={i}>
          {i > 0 && "\n"}
          {line}
        </React.Fragment>
      );
    });
  }

  // Highlight @mentions in regular messages
  const parts = content.split(/(@\S+)/g);
  if (parts.length === 1) return content;

  return parts.map((part, i) => {
    if (part.startsWith("@")) {
      return (
        <span
          key={i}
          style={{
            color: isRight ? "rgba(255,255,255,0.85)" : "#007AFF",
            fontWeight: 600,
          }}
        >
          {part}
        </span>
      );
    }
    return <React.Fragment key={i}>{part}</React.Fragment>;
  });
}

interface ChatBubbleProps {
  bubble: Bubble;
  /** Frame at which content was last updated (for progress flash) */
  flashFrame?: number;
  /** Hide name label and avatar (same sender continuation) */
  hideSenderInfo?: boolean;
}

export const ChatBubble: React.FC<ChatBubbleProps> = ({
  bubble,
  flashFrame,
  hideSenderInfo = false,
}) => {
  const frame = useCurrentFrame();
  const fps = CONFIG.fps;
  const enterFrame = sec(bubble.time);
  const rel = frame - enterFrame;

  // Snappy spring entrance: quick pop-in, minimal overshoot
  const springVal =
    rel >= 0
      ? spring({
          fps,
          frame: rel,
          config: {
            damping: 26,
            stiffness: 380,
            overshootClamping: false,
          },
        })
      : 0;

  const scale = interpolate(springVal, [0, 1], [0.85, 1]);
  const fadeIn = Math.round(fps * 0.07); // ~70ms
  const opacity = interpolate(rel, [0, fadeIn], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress update flash: quick opacity dip when content changes
  const flashLen = Math.round(fps * 0.2); // ~200ms
  let flashOpacity = 1;
  if (flashFrame !== undefined && flashFrame > 0) {
    const flashRel = frame - flashFrame;
    if (flashRel >= 0 && flashRel < flashLen) {
      const mid = Math.round(flashLen * 0.35);
      flashOpacity = interpolate(flashRel, [0, mid, flashLen], [0.7, 0.7, 1], {
        extrapolateRight: "clamp",
      });
    }
  }

  const isRight = bubble.side === "right";
  const cfg = CONFIG.bubble;
  const sideConfig = cfg[bubble.side];
  const fontFamily =
    bubble.font === "JetBrains Mono" ? fontFamilyMono : fontFamilyInter;
  const fontSize =
    bubble.type === "progress" ? cfg.progressTextSize : cfg.textSize;
  const [tlr, trr, brr, blr] = sideConfig.cornerRadius;

  const avatar = AVATARS[bubble.sender];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isRight ? "row-reverse" : "row",
        alignItems: "flex-end",
        gap: 10,
        width: "100%",
        opacity: opacity * flashOpacity,
        transform: `scale(${scale})`,
        transformOrigin: isRight ? "bottom right" : "bottom left",
      }}
    >
      {/* Avatar — only on left side, hidden for continuation messages */}
      {!isRight &&
        avatar &&
        (hideSenderInfo ? (
          <div style={{ width: 70, minWidth: 70, flexShrink: 0 }} />
        ) : (
          <div style={{ marginBottom: 2, flexShrink: 0 }}>
            <Avatar initial={avatar.initial} color={avatar.color} size={70} />
          </div>
        ))}

      {/* Bubble column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: isRight ? "flex-end" : "flex-start",
          maxWidth: `${sideConfig.maxWidthRatio * 100}%`,
        }}
      >
        {/* Name label */}
        {bubble.nameLabel && !hideSenderInfo && (
          <span
            style={{
              fontFamily: fontFamilyInter,
              fontSize: cfg.nameSize,
              fontWeight: 600,
              color: bubble.nameColor,
              marginBottom: 3,
              paddingLeft: 4,
            }}
          >
            {bubble.nameLabel}
          </span>
        )}

        {/* Bubble body */}
        <div
          style={{
            backgroundColor: bubble.bubbleColor,
            borderTopLeftRadius: tlr,
            borderTopRightRadius: trr,
            borderBottomRightRadius: brr,
            borderBottomLeftRadius: blr,
            padding: `${cfg.padding.y}px ${cfg.padding.x}px`,
            boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)",
            borderLeft: bubble.type === "result" ? "4px solid #34C759" : "none",
          }}
        >
          {/* Quote */}
          {bubble.quote && (
            <div
              style={{
                borderLeft: `${cfg.replyBorderWidth}px solid ${isRight ? "rgba(255,255,255,0.4)" : cfg.replyBorderColor}`,
                paddingLeft: 8,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: fontFamilyInter,
                  fontSize: cfg.replyTextSize,
                  color: isRight ? "rgba(255,255,255,0.7)" : cfg.replyTextColor,
                  lineHeight: 1.3,
                }}
              >
                {bubble.quote.length > 40
                  ? bubble.quote.slice(0, 40) + "..."
                  : bubble.quote}
              </span>
            </div>
          )}

          {/* Content with rich highlights */}
          <span
            style={{
              fontFamily,
              fontSize,
              color: bubble.textColor,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {renderRichContent(bubble.content, bubble.type, isRight)}
          </span>
        </div>
      </div>
    </div>
  );
};
