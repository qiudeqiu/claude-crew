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
        padding: "0 16px",
        gap: 16,
        opacity,
        borderBottom: `1px solid #E5E5EA`,
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: header.avatar.size,
          height: header.avatar.size,
          borderRadius: "50%",
          backgroundColor: header.avatar.fill,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 30,
          fontWeight: 700,
          color: "#FFFFFF",
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
            fontWeight: header.titleWeight,
            color: "#1C1C1E",
            lineHeight: 1.2,
          }}
        >
          {header.title}
        </span>
        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: header.subtitleSize,
            color: header.subtitleColor,
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
