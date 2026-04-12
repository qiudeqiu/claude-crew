// Copyright 2026 qiudeqiu. Licensed under Apache-2.0.
/**
 * WeChat iLink media encryption/decryption.
 * Files on WeChat CDN are AES-128-ECB encrypted.
 */

import { createCipheriv, createDecipheriv } from "crypto";

const ALGORITHM = "aes-128-ecb";

/**
 * Encrypt data with AES-128-ECB.
 * @param data Raw file buffer
 * @param key Base64-encoded AES key from WeChat API
 */
export function encrypt(data: Buffer, key: string): Buffer {
  const keyBuf = Buffer.from(key, "base64");
  const cipher = createCipheriv(ALGORITHM, keyBuf, null);
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

/**
 * Decrypt data with AES-128-ECB.
 * @param data Encrypted file buffer
 * @param key Base64-encoded AES key from WeChat API
 */
export function decrypt(data: Buffer, key: string): Buffer {
  const keyBuf = Buffer.from(key, "base64");
  const decipher = createDecipheriv(ALGORITHM, keyBuf, null);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
