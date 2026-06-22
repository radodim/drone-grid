import { useEffect, useState } from "react"

import {
  openReconnectingSocket,
  type SocketStatus,
} from "@/lib/reconnecting-ws"
import { buildApiWsUrl } from "@/lib/ws"
import type { Telemetry } from "@/types/telemetry"

export interface TelemetrySocketState {
  telemetry: Telemetry | null
  status: SocketStatus
  /** Browser-clock ms timestamp of the last received frame. */
  lastMessageAt: number | null
}

/**
 * Read-only socket to /api/v1/telemetry/{droneId} — the backend pushes a
 * Telemetry frame per companion publish (~2Hz); nothing is ever sent.
 * Reconnects with backoff until unmount. Pass an explicit `token` (a `dgs_`
 * share token) for an unauthenticated viewer; defaults to the Keycloak JWT.
 */
export function useTelemetrySocket(
  droneId: string,
  token?: string,
): TelemetrySocketState {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null)
  const [status, setStatus] = useState<SocketStatus>("connecting")
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null)

  useEffect(() => {
    setTelemetry(null)
    setLastMessageAt(null)

    const socket = openReconnectingSocket({
      buildUrl: () => buildApiWsUrl(`/api/v1/telemetry/${droneId}`, token),
      onStatusChange: setStatus,
      onMessage: (event) => {
        try {
          setTelemetry(JSON.parse(event.data) as Telemetry)
          setLastMessageAt(Date.now())
        } catch {
          // Malformed frame — backend validated it, so this should not happen.
        }
      },
    })

    return () => socket.close()
  }, [droneId, token])

  return { telemetry, status, lastMessageAt }
}
