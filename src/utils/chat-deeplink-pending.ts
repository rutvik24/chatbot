/**
 * When a `chat/<id>` link opens while logged out, we stash the id so after sign-in
 * the Chat tab can open that thread from local history.
 */
let pendingChatSessionId: string | null = null;

export function setPendingChatDeepLink(sessionId: string): void {
  const t = sessionId?.trim();
  pendingChatSessionId = t || null;
}

export function takePendingChatDeepLink(): string | null {
  const id = pendingChatSessionId;
  pendingChatSessionId = null;
  return id;
}
