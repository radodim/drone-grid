import { useCallback, useEffect, useRef, useState } from "react"

import keycloak from "@/keycloak"

export type ControlSocketStatus =
  | "idle"
  | "connecting"
  | "open"
  | "closed"
  | "error"

export interface ControlSocketState {
  status: ControlSocketStatus
  send: (payload: object) => void
}

/** Wire protocol — validated by the backend (Pydantic) and consumed by the companion. */
type Axes = {
  pitch: number // -1..1
  roll: number // -1..1
  throttle: number // 0..1 (multicopter convention)
  yaw: number // -1..1
}
type ControlMessage =
  | { type: "control_input"; axes: Axes }
  | { type: "arm" }
  | { type: "disarm" }

/**
 * Manages a single WebSocket to /api/v1/control/{droneId}.
 *
 * The backend forwards every frame received here directly to NATS
 * (drone.<id>.control). It does not parse or reshape the payload.
 *
 * Auth: Keycloak JWT is passed as a query param because browsers can't set
 * headers on native WebSocket connections.
 */
export function useControlSocket(droneId: string): ControlSocketState {
  const [status, setStatus] = useState<ControlSocketStatus>("idle")
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    setStatus("connecting")

    // VITE_API_URL is http(s) — flip the scheme for WebSocket.
    const apiUrl = new URL(import.meta.env.VITE_API_URL)
    apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:"
    apiUrl.pathname = `/api/v1/control/${droneId}`
    apiUrl.searchParams.set("token", keycloak.token ?? "")

    const ws = new WebSocket(apiUrl.toString())
    wsRef.current = ws

    ws.addEventListener("open", () => setStatus("open"))
    ws.addEventListener("close", () => setStatus("closed"))
    ws.addEventListener("error", () => setStatus("error"))

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [droneId])

  const send = useCallback((payload: object) => {
    const ws = wsRef.current
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(payload))
    }
  }, [])

  return { status, send }
}

/** Type-safe helpers for each message kind — keeps callers from free-typing JSON blobs. */
export const controlMessages = {
  control: (
    pitch: number,
    roll: number,
    throttle: number,
    yaw: number,
  ): ControlMessage => ({
    type: "control_input",
    axes: { pitch, roll, throttle, yaw },
  }),
  arm: (): ControlMessage => ({ type: "arm" }),
  disarm: (): ControlMessage => ({ type: "disarm" }),
}
