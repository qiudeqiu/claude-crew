import React from "react";
import { fontFamilyInter } from "../fonts";

interface AvatarProps {
  /** Display character (initial letter) */
  initial: string;
  /** Background color */
  color: string;
  /** Size in px */
  size?: number;
  /** True for bot avatars (different style) */
  isBot?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  initial,
  color,
  size = 44,
  isBot = false,
}) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        minWidth: size,
        borderRadius: "50%",
        backgroundColor: color,
        border: "none",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: fontFamilyInter,
        fontSize: size * 0.42,
        fontWeight: 700,
        color: "#fff",
        lineHeight: 1,
      }}
    >
      {initial}
    </div>
  );
};
