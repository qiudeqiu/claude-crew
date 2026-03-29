import React from "react";
import { Composition } from "remotion";
import { CONFIG } from "./data/bubbles";
import { MainVideo } from "./MainVideo";
import { Scene1_TeamCollab, SCENE1_DURATION } from "./scenes/Scene1_TeamCollab";
import {
  Scene2_BotIdentity,
  SCENE2_DURATION,
} from "./scenes/Scene2_BotIdentity";
import {
  Scene4_SoloCommander,
  SCENE4_DURATION,
} from "./scenes/Scene4_SoloCommander";
import { Scene5_Memory, SCENE5_DURATION } from "./scenes/Scene5_Memory";
import {
  Scene6_ProductIntro,
  SCENE6_DURATION,
} from "./scenes/Scene6_ProductIntro";

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
      {/* Scene 4: Solo Commander */}
      <Composition
        id="Scene4-SoloCommander"
        component={Scene4_SoloCommander}
        durationInFrames={FPS * SCENE4_DURATION}
        fps={FPS}
        width={W}
        height={H}
      />

      {/* Scene 2: One Bot = Many Identities */}
      <Composition
        id="Scene2-BotIdentity"
        component={Scene2_BotIdentity}
        durationInFrames={FPS * SCENE2_DURATION}
        fps={FPS}
        width={W}
        height={H}
      />

      {/* Scene 5: Memory Continuity */}
      <Composition
        id="Scene5-Memory"
        component={Scene5_Memory}
        durationInFrames={FPS * SCENE5_DURATION}
        fps={FPS}
        width={W}
        height={H}
      />

      {/* Scene 6: Product Introduction */}
      <Composition
        id="Scene6-ProductIntro"
        component={Scene6_ProductIntro}
        durationInFrames={FPS * SCENE6_DURATION}
        fps={FPS}
        width={W}
        height={H}
      />
    </>
  );
};
