import { describe, expect, it } from "bun:test"

import type { Health, MavlinkTelemetry, Telemetry } from "@/types/telemetry"
import { deriveDroneState } from "./useDroneState"

const NOW = 1_000_000

function healthyHealth(): Health {
  return {
    is_gyrometer_calibrated: true,
    is_accelerometer_calibrated: true,
    is_magnetometer_calibrated: true,
    is_local_position_ok: true,
    is_global_position_ok: true,
    is_home_position_ok: true,
    is_armable: true,
  }
}

function makeTelemetry(overrides: Partial<MavlinkTelemetry> = {}): Telemetry {
  const ts = new Date(NOW).toISOString()

  return {
    companion_state: "ready",
    companion_state_timestamp: ts,
    mavlink_telemetry: {
      flight_controller_last_seen: ts,
      is_armed: false,
      is_in_air: false,
      flight_mode: "POSCTL",
      battery_percentage: 0.8,
      flight_time_remaining: 600,
      position: { lat: 0, lon: 0, rel_alt: 1.5, abs_alt: 100 },
      gps: { num_satellites: 10, fix_type: "FIX_TYPE_3D" },
      health: healthyHealth(),
      ...overrides,
    },
  }
}

function derive(
  telemetry: Telemetry | null,
  opts: {
    lastMessageAt?: number | null
    socketStatus?: "connecting" | "open" | "reconnecting" | "closed"
    videoError?: string | null
    throttleSafeToArm?: boolean
    now?: number
  } = {},
) {
  return deriveDroneState(
    telemetry,
    opts.lastMessageAt ?? NOW,
    opts.socketStatus ?? "open",
    opts.videoError ?? null,
    opts.throttleSafeToArm ?? true,
    opts.now ?? NOW,
  )
}

describe("telemetry health", () => {
  it("is live with an open socket and fresh frames", () => {
    expect(derive(makeTelemetry()).telemetryHealth).toBe("live")
  })

  it("is down when the socket is not open", () => {
    const state = derive(makeTelemetry(), { socketStatus: "reconnecting" })
    expect(state.telemetryHealth).toBe("down")
    expect(state.canArm).toEqual({ enabled: false, reason: "telemetry lost" })
  })

  it("goes stale when frames stop arriving", () => {
    const state = derive(makeTelemetry(), { now: NOW + 3001 })
    expect(state.telemetryHealth).toBe("stale")
    // Fail safe: stale data must not present live armed/mode values.
    expect(state.armed).toBeNull()
    expect(state.flightMode).toBeNull()
  })
})

describe("fc link health", () => {
  it("is ok when the FC was seen recently (companion clock)", () => {
    expect(derive(makeTelemetry()).fcLinkHealth).toBe("ok")
  })

  it("is stale when the FC has not been seen within the window", () => {
    const telemetry = makeTelemetry({
      flight_controller_last_seen: new Date(NOW - 4000).toISOString(),
    })
    expect(derive(telemetry).fcLinkHealth).toBe("stale")
  })
})

describe("canArm ladder", () => {
  it("arms when everything is healthy", () => {
    expect(derive(makeTelemetry()).canArm).toEqual({
      enabled: true,
      reason: null,
    })
  })

  it("blocks when already armed", () => {
    const state = derive(makeTelemetry({ is_armed: true }))
    expect(state.canArm.reason).toBe("already armed")
  })

  it("blocks when airborne", () => {
    const state = derive(makeTelemetry({ is_in_air: true }))
    expect(state.canArm.reason).toBe("airborne")
  })

  it("names uncalibrated sensors before the armable catch-all", () => {
    const health = { ...healthyHealth(), is_gyrometer_calibrated: false }
    expect(derive(makeTelemetry({ health })).canArm.reason).toBe(
      "sensors not calibrated",
    )
  })

  it("waits for GPS position", () => {
    const health = { ...healthyHealth(), is_global_position_ok: false }
    expect(derive(makeTelemetry({ health })).canArm.reason).toBe(
      "waiting for GPS position",
    )
  })

  it("falls back to the FC's own armable verdict", () => {
    const health = { ...healthyHealth(), is_armable: false }
    expect(derive(makeTelemetry({ health })).canArm.reason).toBe(
      "flight controller reports not armable",
    )
  })

  it("blocks arming on a held throttle", () => {
    const state = derive(makeTelemetry(), { throttleSafeToArm: false })
    expect(state.canArm.reason).toBe("lower throttle to arm")
  })
})

describe("canDisarm", () => {
  it("disarms when armed on the ground", () => {
    const state = derive(makeTelemetry({ is_armed: true }))
    expect(state.canDisarm).toEqual({ enabled: true, reason: null })
  })

  it("never disarms in the air", () => {
    const state = derive(makeTelemetry({ is_armed: true, is_in_air: true }))
    expect(state.canDisarm.reason).toBe("airborne")
  })

  it("blocks when not armed", () => {
    expect(derive(makeTelemetry()).canDisarm.reason).toBe("not armed")
  })
})
