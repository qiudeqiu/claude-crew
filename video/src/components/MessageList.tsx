import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import type { Bubble } from "../data/bubbles";
import { CONFIG } from "../data/bubbles";
import { ChatBubble } from "./ChatBubble";
import { frameToSec, sec } from "../helpers";

interface VisibleBubble {
  bubble: Bubble;
  flashFrame: number;
}

/**
 * Renders visible bubbles at their natural positions — NO auto-scroll.
 * The Camera component handles all viewport movement.
 * Tracks progress update flash frames for animation.
 */
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
          });
        }
      } else {
        map.set(b.id, {
          bubble: b,
          flashFrame: 0,
        });
      }
    }
    return Array.from(map.values());
  }, [bubbles, currentTime]);

  return (
    <div
      style={{
        width: CONFIG.chat.width,
        padding: `${CONFIG.chat.messagePadding.y}px ${CONFIG.chat.messagePadding.x}px`,
        display: "flex",
        flexDirection: "column",
        gap: CONFIG.chat.messageGap,
      }}
    >
      {visibleBubbles.map(({ bubble, flashFrame }) => (
        <ChatBubble
          key={bubble.id}
          bubble={bubble}
          flashFrame={flashFrame}
        />
      ))}
    </div>
  );
};
