import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import type { Bubble } from "../data/bubbles";
import { CONFIG } from "../data/bubbles";
import { ChatBubble } from "./ChatBubble";
import { frameToSec, sec } from "../helpers";

interface VisibleBubble {
  bubble: Bubble;
  flashFrame: number;
  /** True if previous bubble was from the same sender (hide name/avatar, tighter gap) */
  isContinuation: boolean;
}

interface MessageListProps {
  bubbles: Bubble[];
}

export const MessageList: React.FC<MessageListProps> = ({ bubbles }) => {
  const frame = useCurrentFrame();
  const currentTime = frameToSec(frame);

  const visibleBubbles = useMemo(() => {
    const active = bubbles.filter((b) => b.time <= currentTime);
    const map = new Map<string, VisibleBubble>();

    for (const b of active) {
      if (b.updateTarget) {
        const existing = map.get(b.updateTarget);
        if (existing) {
          map.set(b.updateTarget, {
            bubble: { ...existing.bubble, content: b.content },
            flashFrame: sec(b.time),
            isContinuation: existing.isContinuation,
          });
        }
      } else {
        map.set(b.id, {
          bubble: b,
          flashFrame: 0,
          isContinuation: false,
        });
      }
    }

    // Mark continuations (same sender in sequence)
    const list = Array.from(map.values());
    for (let i = 1; i < list.length; i++) {
      if (list[i].bubble.sender === list[i - 1].bubble.sender) {
        list[i] = { ...list[i], isContinuation: true };
      }
    }

    return list;
  }, [bubbles, currentTime]);

  return (
    <div
      style={{
        width: CONFIG.chat.width,
        padding: `${CONFIG.chat.messagePadding.y}px ${CONFIG.chat.messagePadding.x}px`,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {visibleBubbles.map(({ bubble, flashFrame, isContinuation }, i) => (
        <div
          key={bubble.id}
          style={{
            marginTop: i === 0 ? 0 : isContinuation ? 4 : CONFIG.chat.messageGap,
          }}
        >
          <ChatBubble
            bubble={bubble}
            flashFrame={flashFrame}
            hideSenderInfo={isContinuation}
          />
        </div>
      ))}
    </div>
  );
};
