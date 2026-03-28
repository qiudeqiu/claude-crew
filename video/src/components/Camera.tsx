import React from "react";
import { useCurrentFrame, spring, interpolate } from "remotion";
import { CONFIG } from "../data/bubbles";
import { sec, BUBBLE_POSITIONS } from "../helpers";

const W = CONFIG.canvas.width;
const H = CONFIG.canvas.height;
const HEADER_OFFSET = 40 + CONFIG.chat.headerHeight + 12;

/**
 * Apple iMessage-style viewport:
 * - Latest bubble anchored at the lower 1/3 of the screen
 * - Once content reaches that anchor point, new bubbles push old ones up
 * - Before that, content just stacks from the top with no movement
 */

/** The Y position (from top) where the latest bubble should sit */
const ANCHOR_Y = H * (2 / 3);

interface CameraProps {
  children: React.ReactNode;
}

export const Camera: React.FC<CameraProps> = ({ children }) => {
  const frame = useCurrentFrame();
  const fps = CONFIG.fps;

  // Find latest visible bubble and compute where its bottom edge is
  let contentBottom = 0;
  let latestBubbleFrame = 0;
  let prevContentBottom = 0;

  for (const pos of BUBBLE_POSITIONS) {
    const bf = sec(pos.time);
    if (bf <= frame) {
      prevContentBottom = contentBottom;
      contentBottom = HEADER_OFFSET + pos.topY + pos.height + CONFIG.chat.messagePadding.y;
      latestBubbleFrame = bf;
    }
  }

  // How far past the anchor point the content extends
  const overflow = Math.max(0, contentBottom - ANCHOR_Y);
  const prevOverflow = Math.max(0, prevContentBottom - ANCHOR_Y);

  // Shift up by overflow amount with spring easing
  let shiftY = 0;
  if (overflow > 0) {
    const relFrame = frame - latestBubbleFrame;
    if (relFrame >= 0 && overflow !== prevOverflow) {
      const springVal = spring({
        fps,
        frame: relFrame,
        config: {
          damping: 28,
          stiffness: 120,
          overshootClamping: true,
        },
      });
      shiftY = interpolate(springVal, [0, 1], [prevOverflow, overflow]);
    } else {
      shiftY = overflow;
    }
  }

  return (
    <div style={{ width: W, height: H, overflow: "hidden" }}>
      <div
        style={{
          transform: `translateY(${-shiftY}px)`,
          width: W,
        }}
      >
        {children}
      </div>
    </div>
  );
};
