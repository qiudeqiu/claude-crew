// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat iLink Bot QR code login flow.
 * Saves QR code to a temp file for user to scan — avoids image processing issues.
 */

import { writeFileSync } from "fs";
import { join } from "path";
import { WECHAT_BASE_URL, buildHeaders } from "./types.js";
import type { QRCodeResponse, QRCodeStatusResponse } from "./types.js";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 120_000; // 2 min timeout

/**
 * Run the QR code login flow.
 * 1. Fetch QR code from WeChat API
 * 2. Save QR image to temp file
 * 3. Poll for scan confirmation
 * 4. Return bot_token on success
 *
 * @param onQRReady Called with the path to the QR code image file
 * @returns bot_token string, or null if timeout/cancelled
 */
export async function wechatLogin(
  onQRReady: (qrImagePath: string, qrUrl: string) => void,
): Promise<{ token: string; baseUrl: string } | null> {
  // 1. Get QR code
  const resp = await fetch(
    `${WECHAT_BASE_URL}/ilink/bot/get_bot_qrcode?bot_type=3`,
    { headers: { "Content-Type": "application/json" } },
  );

  if (!resp.ok) {
    console.error(`[wechat] QR code fetch failed: HTTP ${resp.status}`);
    return null;
  }

  const data = (await resp.json()) as QRCodeResponse;
  if (!data.qrcode) {
    console.error("[wechat] no qrcode in response");
    return null;
  }

  // 2. Save QR image to temp file (avoid passing base64 image through Claude)
  const tmpDir = process.env.TMPDIR ?? "/tmp";
  const qrPath = join(tmpDir, `wechat-qr-${Date.now()}.png`);
  if (data.qrcode_img_content) {
    writeFileSync(qrPath, Buffer.from(data.qrcode_img_content, "base64"));
  }

  // Notify caller
  onQRReady(qrPath, data.qrcode);

  // 3. Poll for scan confirmation
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));

    try {
      const statusResp = await fetch(
        `${WECHAT_BASE_URL}/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(data.qrcode)}`,
        { headers: { "Content-Type": "application/json" } },
      );

      if (!statusResp.ok) continue;

      const status = (await statusResp.json()) as QRCodeStatusResponse;
      if (status.status === "confirmed" && status.bot_token) {
        return {
          token: status.bot_token,
          baseUrl: status.baseurl ?? WECHAT_BASE_URL,
        };
      }
    } catch {
      // Retry on error
    }
  }

  console.error("[wechat] QR code login timed out");
  return null;
}
