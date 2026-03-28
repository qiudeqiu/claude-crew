import type { Bubble } from "./data/bubbles";
import { BUBBLES, CONFIG } from "./data/bubbles";

/** Seconds to frames */
export const sec = (s: number) => Math.round(s * CONFIG.fps);

/** Current time in seconds from frame number */
export const frameToSec = (frame: number) => frame / CONFIG.fps;

/** Estimate the rendered height of a bubble (px) */
export function estimateBubbleHeight(bubble: Bubble): number {
  const maxWidth = CONFIG.chat.width * CONFIG.bubble[bubble.side].maxWidthRatio;
  const innerWidth = maxWidth - CONFIG.bubble.padding.x * 2;
  const fontSize =
    bubble.type === "progress"
      ? CONFIG.bubble.progressTextSize
      : CONFIG.bubble.textSize;
  const charWidth = fontSize * (bubble.font === "JetBrains Mono" ? 0.62 : 0.55);
  const charsPerLine = Math.floor(innerWidth / charWidth);

  const lines = bubble.content.split("\n");
  let totalLines = 0;
  for (const line of lines) {
    totalLines += Math.max(1, Math.ceil(line.length / charsPerLine));
  }

  const lineHeight = fontSize * 1.5;
  let height = CONFIG.bubble.padding.y * 2 + totalLines * lineHeight;

  if (bubble.nameLabel) height += CONFIG.bubble.nameSize + 8;
  if (bubble.quote) height += CONFIG.bubble.replyTextSize + 16;

  return height;
}

// ── Precomputed bubble positions ──

export interface BubblePosition {
  id: string;
  time: number;
  side: "left" | "right";
  /** Y of the CENTER of this bubble (canvas coordinates, relative to message area top) */
  centerY: number;
  /** Y of the TOP of this bubble */
  topY: number;
  /** Height of this bubble */
  height: number;
}

/**
 * Compute the Y position of every bubble, assuming no scroll.
 * Bubbles stack vertically with gap between them.
 */
export function computePositions(bubbles: Bubble[]): BubblePosition[] {
  const gap = CONFIG.chat.messageGap;
  const pad = CONFIG.chat.messagePadding.y;
  const result: BubblePosition[] = [];
  let y = pad;

  for (const b of bubbles) {
    if (b.updateTarget) continue;
    const h = estimateBubbleHeight(b);
    result.push({
      id: b.id,
      time: b.time,
      side: b.side,
      topY: y,
      centerY: y + h / 2,
      height: h,
    });
    y += h + gap;
  }

  return result;
}

/** All bubble positions (full BUBBLES array), precomputed once at module load */
export const BUBBLE_POSITIONS = computePositions(BUBBLES);

/** Map from bubble ID to position */
export const POSITION_MAP = new Map(BUBBLE_POSITIONS.map((p) => [p.id, p]));

/** Total content height (all bubbles) */
export const TOTAL_CONTENT_HEIGHT =
  BUBBLE_POSITIONS.length > 0
    ? BUBBLE_POSITIONS[BUBBLE_POSITIONS.length - 1].topY +
      BUBBLE_POSITIONS[BUBBLE_POSITIONS.length - 1].height +
      CONFIG.chat.messagePadding.y
    : 0;
