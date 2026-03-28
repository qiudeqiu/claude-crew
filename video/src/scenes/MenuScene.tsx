import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { MENU_STEPS, CONFIG } from "../data/bubbles";
import { fontFamilyInter, fontFamilyMono } from "../fonts";
import { sec, frameToSec } from "../helpers";

/** Typing animation: returns partial string based on elapsed time */
function typedText(
  text: string,
  startTime: number,
  duration: number,
  currentTime: number,
): string {
  const elapsed = currentTime - startTime;
  if (elapsed <= 0) return "";
  const progress = Math.min(1, elapsed / (duration / 1000));
  return text.slice(0, Math.ceil(text.length * progress));
}

export const MenuScene: React.FC = () => {
  const frame = useCurrentFrame();
  const currentTime = frameToSec(frame);
  const { menu } = CONFIG;

  const visibleSteps = useMemo(
    () => MENU_STEPS.filter((s) => s.time <= currentTime),
    [currentTime],
  );

  // Find the latest step for each field
  const tokenText = useMemo(() => {
    const step = visibleSteps.find((s) => s.action === "type_token");
    if (!step) return "";
    return typedText(step.content, step.time, step.duration, currentTime);
  }, [visibleSteps, currentTime]);

  const validation = useMemo(() => {
    const step = visibleSteps.find((s) => s.action === "show_validation");
    if (!step || currentTime < step.time) return null;
    return step.content;
  }, [visibleSteps, currentTime]);

  const nameText = useMemo(() => {
    const step = visibleSteps.find((s) => s.action === "type_name");
    if (!step) return "";
    return typedText(step.content, step.time, step.duration, currentTime);
  }, [visibleSteps, currentTime]);

  const pathText = useMemo(() => {
    const step = visibleSteps.find((s) => s.action === "type_path");
    if (!step) return "";
    return typedText(step.content, step.time, step.duration, currentTime);
  }, [visibleSteps, currentTime]);

  const confirmed = visibleSteps.some((s) => s.action === "click_confirm");
  const result = useMemo(() => {
    const step = visibleSteps.find((s) => s.action === "show_result");
    if (!step || currentTime < step.time) return null;
    return step.content;
  }, [visibleSteps, currentTime]);

  const confirmStep = MENU_STEPS.find((s) => s.action === "click_confirm");
  const confirmContent = confirmed ? (confirmStep?.content ?? "") : "";

  const containerWidth = CONFIG.chat.width;
  const left = (CONFIG.canvas.width - containerWidth) / 2;

  const inputStyle: React.CSSProperties = {
    backgroundColor: menu.inputBackground,
    border: `1px solid ${menu.inputBorder}`,
    borderRadius: 12,
    padding: "18px 20px",
    fontFamily: fontFamilyMono,
    fontSize: 28,
    color: "#1C1C1E",
    width: "100%",
    minHeight: 60,
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: fontFamilyInter,
    fontSize: 26,
    color: "#8E8E93",
    marginBottom: 10,
    fontWeight: 500,
  };

  return (
    <AbsoluteFill style={{ backgroundColor: menu.background }}>
      <div
        style={{
          position: "absolute",
          left,
          top: 60,
          width: containerWidth,
          borderRadius: CONFIG.chat.cornerRadius,
          border: `1px solid ${CONFIG.chat.stroke}`,
          backgroundColor: CONFIG.chat.fill,
          overflow: "hidden",
        }}
      >
        {/* Nav bar */}
        <div
          style={{
            height: CONFIG.chat.headerHeight,
            backgroundColor: CONFIG.chat.headerFill,
            display: "flex",
            alignItems: "center",
            padding: "0 16px",
            gap: 8,
            borderBottom: `1px solid #E5E5EA`,
          }}
        >
          <span
            style={{
              color: "#8E8E93",
              fontSize: 32,
              fontFamily: fontFamilyInter,
            }}
          >
            {"←"}
          </span>
          <span
            style={{
              fontFamily: fontFamilyInter,
              fontSize: 36,
              fontWeight: 600,
              color: "#1C1C1E",
            }}
          >
            Add Bot
          </span>
        </div>

        {/* Form content */}
        <div
          style={{
            padding: "28px 32px",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          {/* Token field */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={labelStyle}>Bot Token</span>
            <div style={inputStyle}>
              {tokenText}
              {tokenText && !validation && (
                <span
                  style={{ opacity: frame % 30 < 15 ? 1 : 0, color: "#007AFF" }}
                >
                  |
                </span>
              )}
            </div>
            {validation && (
              <span
                style={{
                  fontFamily: fontFamilyInter,
                  fontSize: 26,
                  color: menu.successColor,
                  marginTop: 6,
                }}
              >
                {validation}
              </span>
            )}
          </div>

          {/* Name field */}
          {nameText !== "" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={labelStyle}>Project Name</span>
              <div style={inputStyle}>
                {nameText}
                {nameText && !pathText && (
                  <span
                    style={{
                      opacity: frame % 30 < 15 ? 1 : 0,
                      color: "#007AFF",
                    }}
                  >
                    |
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Path field */}
          {pathText !== "" && (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={labelStyle}>Project Path</span>
              <div style={inputStyle}>
                {pathText}
                {pathText && !confirmed && (
                  <span
                    style={{
                      opacity: frame % 30 < 15 ? 1 : 0,
                      color: "#007AFF",
                    }}
                  >
                    |
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Confirm button */}
          {pathText.length > 0 && (
            <div
              style={{
                backgroundColor: confirmed
                  ? menu.buttonHighlight
                  : menu.buttonColor,
                borderRadius: 14,
                padding: "20px 32px",
                textAlign: "center",
                fontFamily: fontFamilyInter,
                fontSize: 30,
                fontWeight: 600,
                color: confirmed ? "#FFFFFF" : "#1C1C1E",
                marginTop: 8,
                transition: "background-color 0.2s",
              }}
            >
              {confirmed ? confirmContent : "Confirm"}
            </div>
          )}

          {/* Restart result */}
          {result && (
            <div
              style={{
                textAlign: "center",
                fontFamily: fontFamilyInter,
                fontSize: 28,
                color: "#8E8E93",
                marginTop: 4,
              }}
            >
              {result}
            </div>
          )}
        </div>
      </div>
    </AbsoluteFill>
  );
};
