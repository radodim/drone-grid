import { useEffect, useMemo, useState } from "react"

import type { SocketStatus } from "@/lib/reconnecting-ws"
import type { CompanionState, Telemetry } from "@/types/telemetry"

export type TelemetryHealth = "live" | "stale" | "down"
export type FcLinkHealth = "ok" | "stale" | "unknown"
export type VideoHealth = "ok" | "error"

export interface Affordance {
  enabled: boolean
  /** Why the action is unavailable; null when enabled. */
  reason: string | null
}

export interface DroneState {
  companionState: CompanionState | null
  armed: boolean | null
  inAir: boolean | null
  flightMode: string | null
  telemetryHealth: TelemetryHealth
  fcLinkHealth: FcLinkHealth
  videoHealth: VideoHealth
  canArm: Affordance
  canDisarm: Affordance
  /** Stick input is meaningful: telemetry is live and the drone is armed. */
  inputLive: boolean
}

export interface DroneStateInputs {
  telemetry: Telemetry | null
  lastMessageAt: number | null
  socketStatus: SocketStatus
  videoError: string | null
  /** From the input coordinator: arming now would command no climb. Gates
   * arming so a held throttle can't command a jump when POSCTL engages. */
  throttleSafeToArm?: boolean
}

/** ~6 missed frames at the companion's 2Hz publish rate. */
const TELEMETRY_STALE_AFTER_MS = 3000
/** Companion-clock age of the last FC message within a telemetry frame. */
const FC_LINK_STALE_AFTER_MS = 3000

/**
 * Single source of truth for drone state in the UI — a pure derivation of
 * the latest telemetry. Control affordances mirror the companion's own
 * gates (the companion stays the enforcer; this is the UX affordance), and
 * fail safe: anything unknown or stale disables commands.
 */
export function useDroneState(inputs: DroneStateInputs): DroneState {
  // Staleness depends on wall time, not new data — tick so it trips even
  // when frames stop arriving.
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const {
    telemetry,
    lastMessageAt,
    socketStatus,
    videoError,
    throttleSafeToArm,
  } = inputs
  return useMemo(
    () =>
      deriveDroneState(
        telemetry,
        lastMessageAt,
        socketStatus,
        videoError,
        throttleSafeToArm ?? true,
        now,
      ),
    [
      telemetry,
      lastMessageAt,
      socketStatus,
      videoError,
      throttleSafeToArm,
      now,
    ],
  )
}

/** Pure; exported for tests. */
export function deriveDroneState(
  telemetry: Telemetry | null,
  lastMessageAt: number | null,
  socketStatus: SocketStatus,
  videoError: string | null,
  throttleSafeToArm: boolean,
  now: number,
): DroneState {
  const telemetryHealth = deriveTelemetryHealth(
    socketStatus,
    lastMessageAt,
    now,
  )
  const live = telemetryHealth === "live"
  const mavlink = live ? (telemetry?.mavlink_telemetry ?? null) : null

  const companionState = live ? (telemetry?.companion_state ?? null) : null
  const armed = mavlink?.is_armed ?? null
  const inAir = mavlink?.is_in_air ?? null

  return {
    companionState,
    armed,
    inAir,
    flightMode: mavlink?.flight_mode ?? null,
    telemetryHealth,
    fcLinkHealth: deriveFcLinkHealth(live ? telemetry : null),
    videoHealth: videoError ? "error" : "ok",
    canArm: deriveCanArm(
      telemetryHealth,
      companionState,
      telemetry,
      throttleSafeToArm,
    ),
    canDisarm: deriveCanDisarm(telemetryHealth, armed, inAir),
    inputLive: live && armed === true,
  }
}

function deriveTelemetryHealth(
  socketStatus: SocketStatus,
  lastMessageAt: number | null,
  now: number,
): TelemetryHealth {
  if (socketStatus !== "open") return "down"
  if (lastMessageAt === null) return "stale"

  return now - lastMessageAt > TELEMETRY_STALE_AFTER_MS ? "stale" : "live"
}

function deriveFcLinkHealth(telemetry: Telemetry | null): FcLinkHealth {
  const mavlink = telemetry?.mavlink_telemetry
  if (telemetry == null || mavlink == null) return "unknown"

  // Both timestamps come from the companion's clock, so the age is immune
  // to browser/companion clock skew.
  const age =
    Date.parse(telemetry.companion_state_timestamp) -
    Date.parse(mavlink.flight_controller_last_seen)
  return age > FC_LINK_STALE_AFTER_MS ? "stale" : "ok"
}

function deriveCanArm(
  telemetryHealth: TelemetryHealth,
  companionState: CompanionState | null,
  telemetry: Telemetry | null,
  throttleSafeToArm: boolean,
): Affordance {
  if (telemetryHealth !== "live") return disabled("telemetry lost")
  if (companionState !== "ready") return disabled("companion not ready")

  const mavlink = telemetry?.mavlink_telemetry
  if (mavlink == null) return disabled("no flight controller data")
  if (mavlink.is_armed) return disabled("already armed")
  if (mavlink.is_in_air) return disabled("airborne")
  if (mavlink.health?.is_armable !== true) return disabled("not armable")
  if (!throttleSafeToArm) return disabled("lower throttle to arm")

  return enabled()
}

function deriveCanDisarm(
  telemetryHealth: TelemetryHealth,
  armed: boolean | null,
  inAir: boolean | null,
): Affordance {
  if (telemetryHealth !== "live") return disabled("telemetry lost")
  if (armed !== true) return disabled("not armed")
  if (inAir !== false) return disabled("airborne")

  return enabled()
}

function disabled(reason: string): Affordance {
  return { enabled: false, reason }
}

function enabled(): Affordance {
  return { enabled: true, reason: null }
}
