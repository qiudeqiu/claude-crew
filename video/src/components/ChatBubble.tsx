import React from "react";
import { useCurrentFrame, spring, interpolate } from "remotion";
import type { Bubble } from "../data/bubbles";
import { CONFIG } from "../data/bubbles";
import { fontFamilyInter, fontFamilyMono } from "../fonts";
import { sec } from "../helpers";
import { Avatar } from "./Avatar";

// Avatar config per sender
const AVATARS: Record<
  string,
  { initial: string; color: string; isBot?: boolean }
> = {
  you: { initial: "我", color: "#5B7B8E" },
  leo: { initial: "李", color: "#5B8DBF" },
  momo: { initial: "墨", color: "#8B7EB8" },
  nova: { initial: "诺", color: "#C4697A" },
  kira: { initial: "琪", color: "#C49A5A" },
  sage: { initial: "森", color: "#5BA89A" },
  商城_bot: { initial: "🛒", color: "#5BA89A", isBot: true },
  官网_bot: { initial: "🌐", color: "#5B8DBF", isBot: true },
  小程序_bot: { initial: "📱", color: "#C49A5A", isBot: true },
  活动_bot: { initial: "🎉", color: "#C4697A", isBot: true },
};

/** Render content with @mention highlights */
function renderRichContent(
  content: string,
  _type: string,
  isRight: boolean,
): React.ReactNode {
  // Highlight @mentions in all messages
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

  // Fast glide entrance: ~120ms settle, no overshoot
  const springVal =
    rel >= 0
      ? spring({
          fps,
          frame: rel,
          config: {
            damping: 30,
            stiffness: 420,
            overshootClamping: true,
          },
        })
      : 0;

  const scale = interpolate(springVal, [0, 1], [0.94, 1]);
  const slideUp = interpolate(springVal, [0, 1], [4, 0]);
  const fadeIn = Math.round(fps * 0.08); // ~80ms
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
        transform: `scale(${scale}) translateY(${slideUp}px)`,
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
            <Avatar
              initial={avatar.initial}
              color={avatar.color}
              size={70}
              isBot={avatar.isBot}
            />
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
            borderTopLeftRadius: tlr + 4,
            borderTopRightRadius: trr + 4,
            borderBottomRightRadius: brr + 4,
            borderBottomLeftRadius: blr + 4,
            padding: `${cfg.padding.y + 4}px ${cfg.padding.x + 4}px`,
            boxShadow: "0 0.5px 1px rgba(0,0,0,0.04)",
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
