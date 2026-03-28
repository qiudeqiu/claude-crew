import React from "react";
import { Composition } from "remotion";
import { CONFIG } from "./data/bubbles";
import { MainVideo } from "./MainVideo";
import {
  Scene1_TeamCollab,
  SCENE1_DURATION,
} from "./scenes/Scene1_TeamCollab";

const FPS = CONFIG.fps;
const W = CONFIG.canvas.width;
const H = CONFIG.canvas.height;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Original full video (legacy) */}
      <Composition
        id="ClaudeCrew"
        component={MainVideo}
        durationInFrames={FPS * CONFIG.durationInSeconds}
        fps={FPS}
        width={W}
        height={H}
      />

      {/* Scene 1: Team Collaboration */}
      <Composition
        id="Scene1-TeamCollab"
        component={Scene1_TeamCollab}
        durationInFrames={FPS * SCENE1_DURATION}
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  );
};
