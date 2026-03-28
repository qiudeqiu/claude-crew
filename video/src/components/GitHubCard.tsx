import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { CONFIG } from "../data/bubbles";
import { fontFamilyInter, fontFamilyMono } from "../fonts";
import { sec } from "../helpers";

/**
 * GitHub project card — appears at the end of each scene.
 * Shows repo name, URL, and GitHub icon.
 */
interface GitHubCardProps {
  startTime: number;
}

export const GitHubCard: React.FC<GitHubCardProps> = ({ startTime }) => {
  const frame = useCurrentFrame();
  const enterFrame = sec(startTime);
  const rel = frame - enterFrame;

  const opacity = interpolate(rel, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  if (opacity <= 0) return null;

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 120,
        opacity,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
        }}
      >
        {/* GitHub icon */}
        <svg width="56" height="56" viewBox="0 0 24 24" fill="#1C1C1E">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>

        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: 36,
            fontWeight: 700,
            color: "#1C1C1E",
          }}
        >
          claude-crew
        </span>

        <span
          style={{
            fontFamily: fontFamilyMono,
            fontSize: 24,
            color: "#007AFF",
          }}
        >
          github.com/anthropics/claude-crew
        </span>

        <span
          style={{
            fontFamily: fontFamilyInter,
            fontSize: 22,
            color: "#AEAEB2",
          }}
        >
          Open Source | 开源项目
        </span>
      </div>
    </AbsoluteFill>
  );
};

/**
 * Small project badge — sits below opening text cards.
 */
export const ProjectBadge: React.FC<{ opacity: number }> = ({ opacity }) => {
  if (opacity <= 0) return null;
  return (
    <div
      style={{
        position: "absolute",
        bottom: 140,
        left: 0,
        right: 0,
        display: "flex",
        justifyContent: "center",
        opacity: opacity * 0.7,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 20px",
          borderRadius: 20,
          backgroundColor: "rgba(0,0,0,0.04)",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#AEAEB2">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
        <span
          style={{
            fontFamily: fontFamilyMono,
            fontSize: 20,
            color: "#AEAEB2",
          }}
        >
          claude-crew
        </span>
      </div>
    </div>
  );
};
