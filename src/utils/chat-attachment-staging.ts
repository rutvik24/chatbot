import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

import type { ChatAttachment } from "@/utils/chat-timeline";

import {
  CHAT_MAX_FILE_BYTES,
  CHAT_MAX_IMAGE_BYTES,
} from "@/utils/chat-attachment-constants";

function extensionFromNameOrMime(name: string, mimeType: string): string {
  const lower = name.toLowerCase();
  const dot = lower.lastIndexOf(".");
  if (dot >= 0 && dot < lower.length - 1) {
    const ext = lower.slice(dot);
    if (ext.length <= 8) return ext;
  }
  const m = mimeType.toLowerCase();
  if (m.includes("pdf")) return ".pdf";
  if (m.includes("png")) return ".png";
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("webp")) return ".webp";
  if (m.includes("gif")) return ".gif";
  if (m.includes("text")) return ".txt";
  if (m.includes("json")) return ".json";
  return ".bin";
}

async function getUriByteLength(uri: string): Promise<number | null> {
  if (uri.startsWith("data:")) {
    const i = uri.indexOf("base64,");
    if (i === -1) return uri.length;
    const b64 = uri.slice(i + 7);
    return Math.floor((b64.length * 3) / 4);
  }
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof info.size === "number" && info.size >= 0) {
      return info.size;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export type StageAttachmentErrorCode =
  | "too_large"
  | "copy_failed"
  | "no_document_dir";

export class StageAttachmentError extends Error {
  constructor(
    message: string,
    readonly code: StageAttachmentErrorCode,
  ) {
    super(message);
    this.name = "StageAttachmentError";
  }
}

/**
 * Copies a picked asset into app document storage (native) or keeps a data URL (web).
 */
export async function stagePickedAsset(input: {
  sourceUri: string;
  name: string;
  mimeType: string;
  kind: "image" | "file";
}): Promise<ChatAttachment> {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const maxBytes = input.kind === "image" ? CHAT_MAX_IMAGE_BYTES : CHAT_MAX_FILE_BYTES;

  const size = await getUriByteLength(input.sourceUri);
  if (size != null && size > maxBytes) {
    throw new StageAttachmentError(
      input.kind === "image"
        ? "That image is too large. Try a smaller photo or lower resolution."
        : "That file is too large. Try a smaller PDF or document.",
      "too_large",
    );
  }

  if (Platform.OS === "web") {
    if (input.sourceUri.startsWith("data:")) {
      return {
        id,
        name: input.name,
        mimeType: input.mimeType || "application/octet-stream",
        kind: input.kind,
        localUri: input.sourceUri,
      };
    }
    // Blob or remote URI on web: fetch → data URL
    try {
      const res = await fetch(input.sourceUri);
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("read failed"));
        };
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(blob);
      });
      const len = await getUriByteLength(dataUrl);
      if (len != null && len > maxBytes) {
        throw new StageAttachmentError(
          input.kind === "image"
            ? "That image is too large after loading."
            : "That file is too large after loading.",
          "too_large",
        );
      }
      return {
        id,
        name: input.name,
        mimeType: input.mimeType || blob.type || "application/octet-stream",
        kind: input.kind,
        localUri: dataUrl,
      };
    } catch (e) {
      if (e instanceof StageAttachmentError) throw e;
      throw new StageAttachmentError(
        "Couldn’t read that file in the browser.",
        "copy_failed",
      );
    }
  }

  const base = FileSystem.documentDirectory;
  if (!base) {
    throw new StageAttachmentError(
      "App storage isn’t available on this device.",
      "no_document_dir",
    );
  }

  const dir = `${base}chat-attachments`;
  try {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  } catch {
    /* exists */
  }

  const ext = extensionFromNameOrMime(input.name, input.mimeType);
  const dest = `${dir}/${id}${ext}`;

  try {
    await FileSystem.copyAsync({ from: input.sourceUri, to: dest });
  } catch {
    throw new StageAttachmentError(
      "Couldn’t save the attachment. Try again.",
      "copy_failed",
    );
  }

  return {
    id,
    name: input.name,
    mimeType: input.mimeType || "application/octet-stream",
    kind: input.kind,
    localUri: dest,
  };
}
