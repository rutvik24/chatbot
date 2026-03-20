/**
 * Maps in-app chat messages to **`client.chat.completions.create` `messages`**, using the official
 * OpenAI Node/TS SDK message and content-part shapes.
 *
 * @see https://www.npmjs.com/package/openai — Chat Completions, File uploads (`toFile`)
 * @see https://platform.openai.com/docs/guides/vision — image_url parts
 * @see https://platform.openai.com/docs/guides/text — `file` parts (`file_data`, `file_id`)
 * @see docs/openai-sdk-file-support.md — how this repo applies the above on mobile + gateways
 */

import * as FileSystem from "expo-file-system/legacy";
import type {
  ChatCompletionContentPart,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

import {
  CHAT_DEFAULT_ATTACHMENT_PROMPT,
  CHAT_MAX_TEXT_FILE_CHARS,
} from "@/utils/chat-attachment-constants";
import type { ChatMessageWithTime } from "@/utils/chat-timeline";

/** Re-export SDK types for callers (e.g. streaming service, chat screen). */
export type { ChatCompletionContentPart, ChatCompletionMessageParam };

function parseDataUrl(dataUrl: string): { mime: string; base64: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl);
  if (!m) return null;
  return { mime: m[1].trim(), base64: m[2].trim() };
}

async function readBase64FromUri(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    const parsed = parseDataUrl(uri);
    if (parsed) return parsed.base64;
    const i = uri.indexOf("base64,");
    if (i !== -1) return uri.slice(i + 7);
    throw new Error("Unsupported data URL");
  }
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

function base64ToUtf8(b64: string): string {
  const bin = typeof atob !== "undefined" ? atob(b64) : "";
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

async function readUtf8FromUri(uri: string): Promise<string> {
  if (uri.startsWith("data:")) {
    const parsed = parseDataUrl(uri);
    if (parsed) return base64ToUtf8(parsed.base64);
    throw new Error("Unsupported data URL for text");
  }
  return FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

function isProbablyTextMime(mime: string): boolean {
  const m = mime.toLowerCase();
  return (
    m.startsWith("text/") ||
    m.includes("json") ||
    m.includes("javascript") ||
    m.includes("xml") ||
    m === "application/csv"
  );
}

/**
 * Builds a user message `content` array: `text`, `image_url`, and `file` parts per
 * {@link ChatCompletionContentPart}.
 */
export async function attachmentsToContentParts(
  text: string,
  attachments: NonNullable<ChatMessageWithTime["attachments"]>,
): Promise<ChatCompletionContentPart[]> {
  const parts: ChatCompletionContentPart[] = [];
  const trimmed = text.trim();
  const preamble =
    trimmed ||
    (attachments.length > 0 ? CHAT_DEFAULT_ATTACHMENT_PROMPT : "");

  if (preamble) {
    parts.push({ type: "text", text: preamble });
  }

  for (const a of attachments) {
    const uri = a.localUri;
    if (!uri) {
      parts.push({
        type: "text",
        text: `[Attached file unavailable on this device/session: “${a.name}” (${a.mimeType}). Ask the user to re-attach it if needed.]`,
      });
      continue;
    }

    const mime = (a.mimeType || "").toLowerCase();
    const treatAsImage = a.kind === "image" || mime.startsWith("image/");

    if (treatAsImage) {
      let dataUrl: string;
      if (uri.startsWith("data:")) {
        dataUrl = uri;
      } else {
        const b64 = await readBase64FromUri(uri);
        const mt = mime || "image/jpeg";
        dataUrl = `data:${mt};base64,${b64}`;
      }
      parts.push({
        type: "image_url",
        image_url: { url: dataUrl, detail: "auto" },
      });
      continue;
    }

    if (mime === "application/pdf" || a.name.toLowerCase().endsWith(".pdf")) {
      const b64 = await readBase64FromUri(uri);
      parts.push({
        type: "file",
        file: { filename: a.name, file_data: b64 },
      });
      continue;
    }

    if (isProbablyTextMime(mime)) {
      try {
        let body = await readUtf8FromUri(uri);
        if (body.length > CHAT_MAX_TEXT_FILE_CHARS) {
          body =
            body.slice(0, CHAT_MAX_TEXT_FILE_CHARS) +
            "\n\n[…truncated for length…]";
        }
        parts.push({
          type: "text",
          text: `--- File: ${a.name} ---\n${body}`,
        });
      } catch {
        const b64 = await readBase64FromUri(uri);
        parts.push({
          type: "file",
          file: { filename: a.name, file_data: b64 },
        });
      }
      continue;
    }

    const b64 = await readBase64FromUri(uri);
    parts.push({
      type: "file",
      file: { filename: a.name, file_data: b64 },
    });
  }

  return parts;
}

export async function chatMessageToApiMessage(
  m: ChatMessageWithTime,
): Promise<ChatCompletionMessageParam> {
  if (m.role === "assistant") {
    return { role: "assistant", content: m.content };
  }

  const atts = m.attachments?.filter(Boolean) ?? [];
  if (atts.length === 0) {
    return { role: "user", content: m.content };
  }

  const content = await attachmentsToContentParts(m.content, atts);
  return { role: "user", content };
}

/**
 * Full message list for `chat.completions.create`, including optional system personalization.
 */
export async function buildChatCompletionHistory(
  personalization: { role: "system"; content: string } | null,
  recentTurns: ChatMessageWithTime[],
): Promise<ChatCompletionMessageParam[]> {
  const core = await Promise.all(recentTurns.map(chatMessageToApiMessage));
  if (personalization) {
    return [personalization, ...core];
  }
  return core;
}
