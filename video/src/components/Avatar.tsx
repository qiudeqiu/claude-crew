import React from "react";
import { fontFamilyInter } from "../fonts";

interface AvatarProps {
  /** Display character (initial letter or emoji) */
  initial: string;
  /** Background color */
  color: string;
  /** Size in px */
  size?: number;
}

export const Avatar: React.FC<AvatarProps> = ({
  initial,
  color,
  size = 44,
}) => {
  // Emoji avatars (bots) don't need the gradient ring
  const isEmoji = /\p{Emoji}/u.test(initial) && initial.length > 1;

  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        background: isEmoji
          ? color
          : `linear-gradient(135deg, ${color}, ${adjustBrightness(color, -25)})`,
        boxShadow: `0 2px 8px ${color}40`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fontFamilyInter,
        fontSize: isEmoji ? size * 0.48 : size * 0.42,
        fontWeight: 700,
        color: "#fff",
        lineHeight: 1,
      }}
    >
      {initial}
    </div>
  );
};

/** Darken or lighten a hex color */
function adjustBrightness(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + amount));
  const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + amount));
  const b = Math.max(0, Math.min(255, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
