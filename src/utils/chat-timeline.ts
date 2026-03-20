/**
 * Chat list rows: real messages plus centered “day” section headers (Today, Yesterday, …).
 */

export type ChatMessageWithTime = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Unix ms when the message was created (user send / assistant placeholder). */
  createdAt: number;
};

export type ChatTimelineRow =
  | { kind: "day"; id: string; dayKey: string; label: string }
  | ({ kind: "message" } & ChatMessageWithTime);

function localDayKey(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfLocalDayMs(ms: number): number {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Centered section title for a calendar day (locale-aware).
 */
export function formatDaySectionLabel(
  messageTimeMs: number,
  nowMs: number = Date.now(),
): string {
  const msgStart = startOfLocalDayMs(messageTimeMs);
  const todayStart = startOfLocalDayMs(nowMs);
  const yesterdayStart = todayStart - 86400000;

  if (msgStart === todayStart) return "Today";
  if (msgStart === yesterdayStart) return "Yesterday";

  const d = new Date(messageTimeMs);
  const now = new Date(nowMs);
  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "short",
    day: "numeric",
  };
  if (d.getFullYear() !== now.getFullYear()) {
    options.year = "numeric";
  }
  return d.toLocaleDateString(undefined, options);
}

/**
 * Short time for under each bubble (locale-aware, 12h/24h from device).
 */
export function formatMessageTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * Inserts a centered day row before the first message of each calendar day.
 */
export function buildChatTimelineRows(
  messages: ChatMessageWithTime[],
): ChatTimelineRow[] {
  const rows: ChatTimelineRow[] = [];
  let lastDayKey: string | null = null;

  for (const m of messages) {
    const dayKey = localDayKey(m.createdAt);
    if (dayKey !== lastDayKey) {
      rows.push({
        kind: "day",
        id: `day-${dayKey}`,
        dayKey,
        label: formatDaySectionLabel(m.createdAt),
      });
      lastDayKey = dayKey;
    }
    rows.push({ kind: "message", ...m });
  }

  return rows;
}
