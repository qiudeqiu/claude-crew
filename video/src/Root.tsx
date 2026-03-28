import React from "react";
import { Composition } from "remotion";
import { CONFIG } from "./data/bubbles";
import { MainVideo } from "./MainVideo";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ClaudeCrew"
        component={MainVideo}
        durationInFrames={CONFIG.fps * CONFIG.durationInSeconds}
        fps={CONFIG.fps}
        width={CONFIG.canvas.width}
        height={CONFIG.canvas.height}
      />
    </>
  );
};
