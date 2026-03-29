import React from "react";
import { AbsoluteFill } from "remotion";

/**
 * Decorative background blobs that make frosted glass effect visible.
 * Large, soft, colorful circles behind the chat card.
 */
export const GlassBackground: React.FC<{ children?: React.ReactNode }> = ({
  children,
}) => {
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg, #F5F5F7 0%, #ECECEE 100%)",
      }}
    >
      {/* Top-right blue blob */}
      <div
        style={{
          position: "absolute",
          top: 120,
          right: -80,
          width: 500,
          height: 500,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(51,144,236,0.15) 0%, transparent 70%)",
        }}
      />
      {/* Left purple blob */}
      <div
        style={{
          position: "absolute",
          top: 600,
          left: -100,
          width: 600,
          height: 600,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(164,94,255,0.12) 0%, transparent 70%)",
        }}
      />
      {/* Bottom-right green blob */}
      <div
        style={{
          position: "absolute",
          bottom: 200,
          right: -50,
          width: 450,
          height: 450,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(0,209,160,0.12) 0%, transparent 70%)",
        }}
      />
      {/* Center-left orange blob */}
      <div
        style={{
          position: "absolute",
          top: 1100,
          left: 100,
          width: 400,
          height: 400,
          borderRadius: "50%",
          background:
            "radial-gradient(circle, rgba(255,145,0,0.10) 0%, transparent 70%)",
        }}
      />
      {children}
    </AbsoluteFill>
  );
};
