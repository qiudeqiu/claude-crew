import React from "react";
import { AbsoluteFill } from "remotion";
import { BUBBLES, CONFIG } from "../data/bubbles";
import { ChatHeader } from "../components/ChatHeader";
import { MessageList } from "../components/MessageList";

export const ChatScene: React.FC = () => {
  const { canvas, chat, background } = CONFIG;
  const chatLeft = (canvas.width - chat.width) / 2;

  return (
    <AbsoluteFill style={{ backgroundColor: background }}>
      {/* Header floats at top, no container box */}
      <div
        style={{
          position: "absolute",
          left: chatLeft,
          top: 40,
          width: chat.width,
        }}
      >
        <ChatHeader />
      </div>

      {/* Messages float freely on dark background */}
      <div
        style={{
          position: "absolute",
          left: chatLeft,
          top: 40 + chat.headerHeight + 12,
          width: chat.width,
        }}
      >
        <MessageList bubbles={BUBBLES} />
      </div>
    </AbsoluteFill>
  );
};
