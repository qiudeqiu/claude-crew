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
  const opacity = interpolate(rel, [0, 2], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Progress update flash: quick opacity dip when content changes
  let flashOpacity = 1;
  if (flashFrame !== undefined && flashFrame > 0) {
    const flashRel = frame - flashFrame;
    if (flashRel >= 0 && flashRel < 6) {
      flashOpacity = interpolate(flashRel, [0, 2, 5], [0.7, 0.7, 1], {
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
          }}
        >
          {/* Quote */}
          {bubble.quote && (
            <div
              style={{
                borderLeft: `${cfg.replyBorderWidth}px solid ${cfg.replyBorderColor}`,
                paddingLeft: 8,
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: fontFamilyInter,
                  fontSize: cfg.replyTextSize,
                  color: cfg.replyTextColor,
                  lineHeight: 1.3,
                }}
              >
                {bubble.quote.length > 40
                  ? bubble.quote.slice(0, 40) + "..."
                  : bubble.quote}
              </span>
            </div>
          )}

          {/* Content */}
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
            {bubble.content}
          </span>
        </div>
      </div>
    </div>
  );
};
