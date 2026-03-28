import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import type { Bubble } from "../data/bubbles";
import { CONFIG } from "../data/bubbles";
import { ChatBubble } from "./ChatBubble";
import { frameToSec, sec } from "../helpers";
import { fontFamilyInter } from "../fonts";

interface VisibleBubble {
  bubble: Bubble;
  flashFrame: number;
  /** True if previous bubble was from the same sender (hide name/avatar, tighter gap) */
  isContinuation: boolean;
  /** Show a time separator before this bubble */
  timeSeparator?: string;
}

// Time labels keyed by phase prefix → display string
const PHASE_TIMES: Record<string, string> = {
  "1-": "9:01",
  "2-": "9:02",
  "3-": "9:02",
  "4-": "9:04",
  "5-": "9:06",
  "6-": "9:08",
  "7-": "9:10",
  "9a": "9:15",
  "9c": "9:16",
  "9d": "9:16",
  "9e": "9:17",
};

function getTimeForPhase(phase: string): string | undefined {
  for (const [prefix, time] of Object.entries(PHASE_TIMES)) {
    if (phase.startsWith(prefix)) return time;
  }
  return undefined;
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

    // Mark continuations and add time separators
    const list = Array.from(map.values());
    let lastPhase = "";
    for (let i = 0; i < list.length; i++) {
      // Same sender continuation
      if (i > 0 && list[i].bubble.sender === list[i - 1].bubble.sender) {
        list[i] = { ...list[i], isContinuation: true };
      }
      // Time separator on phase change
      const phase = list[i].bubble.phase;
      if (phase !== lastPhase) {
        const time = getTimeForPhase(phase);
        if (time && time !== getTimeForPhase(lastPhase)) {
          list[i] = { ...list[i], timeSeparator: time };
        }
        lastPhase = phase;
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
      {visibleBubbles.map(
        ({ bubble, flashFrame, isContinuation, timeSeparator }, i) => (
          <React.Fragment key={bubble.id}>
            {/* Time separator — pill-shaped label */}
            {timeSeparator && (
              <div
                style={{
                  textAlign: "center",
                  marginTop: i === 0 ? 4 : 24,
                  marginBottom: 16,
                }}
              >
                <span
                  style={{
                    fontFamily: fontFamilyInter,
                    fontSize: 21,
                    color: "#AEAEB2",
                    fontWeight: 500,
                    backgroundColor: "rgba(0,0,0,0.04)",
                    padding: "5px 16px",
                    borderRadius: 20,
                  }}
                >
                  {timeSeparator}
                </span>
              </div>
            )}
            <div
              style={{
                marginTop: timeSeparator
                  ? 0
                  : i === 0
                    ? 0
                    : isContinuation
                      ? 4
                      : CONFIG.chat.messageGap,
              }}
            >
              <ChatBubble
                bubble={bubble}
                flashFrame={flashFrame}
                hideSenderInfo={isContinuation}
              />
            </div>
          </React.Fragment>
        ),
      )}
    </div>
  );
};
