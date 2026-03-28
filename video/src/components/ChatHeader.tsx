import React from "react";
import { useCurrentFrame, interpolate } from "remotion";
import { CONFIG } from "../data/bubbles";
import { fontFamilyInter } from "../fonts";
import { sec } from "../helpers";

export const ChatHeader: React.FC = () => {
  const frame = useCurrentFrame();
  const { header, chat } = CONFIG;

  const opacity = interpolate(frame, [0, sec(0.3)], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: chat.width,
        height: chat.headerHeight,
        display: "flex",
        alignItems: "center",
        padding: "0 24px",
        gap: 16,
        opacity,
        background: "rgba(245, 245, 247, 0.85)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(0,0,0,0.06)",
        borderRadius: "24px 24px 0 0",
      }}
    >
      {/* Group Avatar */}
      <div
        style={{
          width: header.avatar.size,
          height: header.avatar.size,
          borderRadius: "50%",
          background: `linear-gradient(135deg, ${header.avatar.fill}, #0055CC)`,
          boxShadow: `0 4px 12px ${header.avatar.fill}30`,
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
        CC
      </div>

      {/* Title + subtitle */}
      <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: header.titleSize,
            fontWeight: 700,
            color: "#1C1C1E",
            lineHeight: 1.2,
            letterSpacing: "-0.01em",
          }}
        >
          {header.title}
        </span>
        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: header.subtitleSize,
            color: "#AEAEB2",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {header.subtitle}
        </span>
      </div>
    </div>
  );
};
