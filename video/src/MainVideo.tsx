import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { CONFIG } from "./data/bubbles";
import { sec } from "./helpers";
import { ChatScene } from "./scenes/ChatScene";
import { MenuScene } from "./scenes/MenuScene";
import { ClosingScene } from "./scenes/ClosingScene";
import { IntroScene } from "./scenes/IntroScene";
import { Camera } from "./components/Camera";

export const MainVideo: React.FC = () => {
  const frame = useCurrentFrame();

  const menuStart = sec(CONFIG.menu.startTime);
  const menuEnd = sec(CONFIG.menu.endTime);
  const closingStart = sec(CONFIG.closing.startTime);

  // Chat fades in after intro
  const chatOpacity = interpolate(
    frame,
    [sec(2.0), sec(3.0)],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const fadeToBlack = interpolate(
    frame,
    [sec(57.5), closingStart],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const chatVisible = frame < closingStart;
  const menuVisible = frame >= menuStart && frame < menuEnd;

  return (
    <AbsoluteFill style={{ backgroundColor: CONFIG.background }}>
      {/* Chat scene with camera — fades in after intro */}
      {chatVisible && !menuVisible && (
        <div style={{ opacity: chatOpacity }}>
          <Camera>
            <ChatScene />
          </Camera>
        </div>
      )}

      {/* Menu scene (no camera — static) */}
      {menuVisible && <MenuScene />}

      {/* Intro title overlay — on top of everything, fades out by 2.8s */}
      <IntroScene />

      {/* Fade to black before closing */}
      {fadeToBlack > 0 && frame < closingStart + sec(1) && (
        <AbsoluteFill
          style={{
            backgroundColor: CONFIG.closing.background,
            opacity: fadeToBlack,
          }}
        />
      )}

      {/* Closing scene */}
      {frame >= closingStart && <ClosingScene />}
    </AbsoluteFill>
  );
};
