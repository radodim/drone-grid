export type SocketStatus = "connecting" | "open" | "reconnecting" | "closed"

export interface ReconnectingSocket {
  /** Sends if currently open, silently drops otherwise. */
  send: (data: string) => void
  close: () => void
}

interface ReconnectingSocketOptions {
  /** Called per connection attempt, so each retry picks up a fresh URL
   * (and with it the current Keycloak token). May be async — token refresh
   * happens inside it. */
  buildUrl: () => string | Promise<string>
  onMessage?: (event: MessageEvent) => void
  onStatusChange: (status: SocketStatus) => void
  baseDelayMs?: number
  maxDelayMs?: number
}

/**
 * A WebSocket that reconnects with capped exponential backoff until close()
 * is called. Errors surface as "reconnecting" (the browser always follows
 * an errored socket with a close event).
 */
export function openReconnectingSocket({
  buildUrl,
  onMessage,
  onStatusChange,
  baseDelayMs = 1000,
  maxDelayMs = 15000,
}: ReconnectingSocketOptions): ReconnectingSocket {
  let ws: WebSocket | null = null
  let attempt = 0
  let timer: number | null = null
  let closed = false

  const connect = async () => {
    onStatusChange(attempt === 0 ? "connecting" : "reconnecting")
    const url = await buildUrl()
    if (closed) return // close() raced the async URL build
    ws = new WebSocket(url)
    ws.addEventListener("open", () => {
      attempt = 0
      onStatusChange("open")
    })
    if (onMessage) ws.addEventListener("message", onMessage)
    ws.addEventListener("close", () => {
      if (closed) return
      const delay = Math.min(baseDelayMs * 2 ** attempt, maxDelayMs)
      attempt += 1
      onStatusChange("reconnecting")
      timer = window.setTimeout(connect, delay)
    })
  }
  void connect()

  return {
    send: (data: string) => {
      if (ws && ws.readyState === WebSocket.OPEN) ws.send(data)
    },
    close: () => {
      closed = true
      if (timer !== null) window.clearTimeout(timer)
      ws?.close()
      onStatusChange("closed")
    },
  }
}
