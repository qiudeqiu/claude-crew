// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * Feishu-specific types — SDK event payloads and card structures.
 */

/** im.message.receive_v1 event payload */
export type FeishuMessageEvent = {
  message?: {
    chat_id?: string;
    chat_type?: string; // "p2p" | "group"
    message_id?: string;
    root_id?: string;
    parent_id?: string;
    content?: string; // JSON string, e.g. {"text":"hello"}
    message_type?: string; // "text" | "image" | "interactive" | ...
    mentions?: FeishuMention[];
  };
  sender?: {
    sender_id?: {
      open_id?: string;
      user_id?: string;
      union_id?: string;
    };
    sender_type?: string; // "user" | "app"
    tenant_key?: string;
  };
};

export type FeishuMention = {
  key?: string; // "@_user_1"
  id?: { open_id?: string; user_id?: string; union_id?: string };
  name?: string;
  tenant_key?: string;
  mentioned_type?: string; // "user" | "bot"
};

/** card.action.trigger event payload */
export type FeishuCardAction = {
  action?: {
    value?: Record<string, string>;
    tag?: string; // "button" | "select_static" | ...
    option?: string; // selected option value
  };
  operator?: {
    open_id?: string;
    user_id?: string;
  };
  context?: {
    open_message_id?: string;
    open_chat_id?: string;
  };
};

/** Card JSON 1.0 element types (subset used by adapter) */
export type CardElement =
  | CardDivElement
  | CardActionElement
  | CardNoteElement
  | CardHrElement;

export type CardDivElement = {
  tag: "div";
  text: { tag: "lark_md" | "plain_text"; content: string };
};

export type CardActionElement = {
  tag: "action";
  actions: CardActionItem[];
};

export type CardActionItem = {
  tag: "button" | "select_static";
  text?: { tag: "plain_text"; content: string };
  type?: "primary" | "default" | "danger";
  value?: Record<string, string>;
  // select_static specific
  placeholder?: { tag: "plain_text"; content: string };
  options?: Array<{
    text: { tag: "plain_text"; content: string };
    value: string;
  }>;
};

export type CardNoteElement = {
  tag: "note";
  elements: Array<{ tag: "plain_text" | "lark_md"; content: string }>;
};

export type CardHrElement = {
  tag: "hr";
};

/** Full Card JSON 1.0 structure */
export type FeishuCard = {
  config?: { wide_screen_mode?: boolean };
  header?: {
    title: { tag: "plain_text"; content: string };
    template?: string; // color: blue, green, red, yellow, etc.
  };
  elements: CardElement[];
};
