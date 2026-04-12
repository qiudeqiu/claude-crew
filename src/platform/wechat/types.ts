// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat iLink Bot API types.
 */

/** Single message item in a WeChat message */
export type WeChatMessageItem = {
  type: number; // 1=text, 2=image, 3=voice, 4=file, 5=video
  text_item?: { text: string };
  image_item?: { url: string; aes_key: string };
  file_item?: { url: string; file_name: string; file_size: number; aes_key: string };
};

/** Inbound message from getupdates */
export type WeChatMessage = {
  from_user_id?: string;
  to_user_id?: string;
  message_type?: number;
  message_state?: number;
  context_token?: string;
  item_list?: WeChatMessageItem[];
};

/** Response from POST /ilink/bot/getupdates */
export type WeChatPollResponse = {
  ret?: number;
  msgs?: WeChatMessage[];
  get_updates_buf?: string;
  longpolling_timeout_ms?: number;
};

/** Response from POST /ilink/bot/getuploadurl */
export type WeChatUploadUrlResponse = {
  url?: string;
  file_id?: string;
  aes_key?: string;
};
