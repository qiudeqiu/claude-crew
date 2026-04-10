// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * Feishu Card JSON 1.0 builders — converts platform-agnostic Button[][] to
 * Feishu interactive card format.
 *
 * Card JSON 1.0 is required for interactive elements (buttons, selects).
 * Card JSON 2.0 only supports content elements (markdown, div).
 */

import type { Button } from "../types.js";
import type { FeishuCard, CardElement } from "./types.js";

/**
 * Build a Card JSON 1.0 with text content and optional button rows.
 * Maps directly from the platform-agnostic Button[][] used by sendButtons/editButtons.
 */
export function buildCard(text: string, buttons: Button[][]): FeishuCard {
  const elements: CardElement[] = [];

  // Content section
  if (text) {
    elements.push({
      tag: "div",
      text: { tag: "lark_md", content: text },
    });
  }

  // Button rows → action elements
  const actionItems = buttonsToActions(buttons);
  if (actionItems.length > 0) {
    elements.push({
      tag: "action",
      actions: actionItems,
    });
  }

  return {
    config: { wide_screen_mode: true },
    elements,
  };
}

/**
 * Build a text-only card (no buttons). Used for sendMessage as card
 * when rich formatting is needed.
 */
export function buildTextCard(text: string): FeishuCard {
  return {
    config: { wide_screen_mode: true },
    elements: [
      {
        tag: "div",
        text: { tag: "lark_md", content: text },
      },
    ],
  };
}

/**
 * Convert platform-agnostic Button[][] to Feishu action items.
 * Flattens all rows into a single action block (Feishu renders buttons inline).
 */
function buttonsToActions(
  buttons: Button[][],
): Array<{
  tag: "button";
  text: { tag: "plain_text"; content: string };
  type: "primary" | "default" | "danger";
  value: Record<string, string>;
}> {
  const actions: Array<{
    tag: "button";
    text: { tag: "plain_text"; content: string };
    type: "primary" | "default" | "danger";
    value: Record<string, string>;
  }> = [];

  for (const row of buttons) {
    for (const btn of row) {
      actions.push({
        tag: "button",
        text: { tag: "plain_text", content: btn.text },
        type: inferButtonType(btn.data),
        value: { data: btn.data },
      });
    }
  }

  return actions;
}

/**
 * Infer button style from callback data pattern.
 * - approve:yes / confirm → primary (blue)
 * - approve:no / cancel / back → danger (red)
 * - everything else → default (gray)
 */
function inferButtonType(data: string): "primary" | "default" | "danger" {
  if (/approve:yes|confirm|:add|:save/.test(data)) return "primary";
  if (/approve:no|cancel|:back|:close/.test(data)) return "danger";
  return "default";
}
