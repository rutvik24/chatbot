/** Max attachments per outgoing user message. */
export const CHAT_MAX_ATTACHMENTS = 6;

/** Reject larger images before upload (bytes). */
export const CHAT_MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** PDF / binary file cap (bytes). */
export const CHAT_MAX_FILE_BYTES = 12 * 1024 * 1024;

/** Inline text snippet from a text file (bytes UTF-8 approx via char length). */
export const CHAT_MAX_TEXT_FILE_CHARS = 48_000;

/** Web: drop data URLs from persisted history above this string length (localStorage). */
export const CHAT_WEB_PERSIST_DATA_URL_MAX_CHARS = 100_000;

/** When the user sends only attachments with no caption. */
export const CHAT_DEFAULT_ATTACHMENT_PROMPT =
  "I've shared the attached file(s). Please read them carefully and help me based on what you see.";
