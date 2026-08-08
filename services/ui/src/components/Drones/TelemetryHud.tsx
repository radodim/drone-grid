import { Altimeter } from "@/components/Drones/Altimeter"
import { HudChip } from "@/components/Drones/HudChip"
import { LinkIndicators } from "@/components/Drones/LinkIndicators"
import type { DroneState, TelemetryHealth } from "@/hooks/useDroneState"
import type { SocketStatus } from "@/lib/reconnecting-ws"
import { cn } from "@/lib/utils"
import type { Gps, Telemetry } from "@/types/telemetry"

interface TelemetryHudProps {
  telemetry: Telemetry | null
  droneState: DroneState
  /** Omitted for read-only share viewers — hides the CTRL chip. */
  controlStatus?: SocketStatus
}

/**
 * Flight-critical OSD, always over the video: armed + flight mode top-left,
 * battery top-right, altitude on the right edge. The video center stays
 * clear. On @hud+ containers the top-right column also carries the
 * diagnostics; narrow layouts render those via TelemetryStrip below the
 * picture instead. Each element carries exactly one non-derivable fact and
 * renders dashes when data is missing. Companion state is deliberately not
 * rendered — it's derivable from TELEM + DRONE.
 */
export function TelemetryHud({
  telemetry,
  droneState,
  controlStatus,
}: TelemetryHudProps) {
  const mavlink = telemetry?.mavlink_telemetry ?? null
  // These readouts render the RAW last frame, which outlives the feed.
  // Last-known values are worth keeping on screen (where was it, how much
  // battery did it have) — but stale data must not wear live colors, so
  // the chips dim and their dots go neutral until telemetry is live again.
  const stale = droneState.telemetryHealth !== "live"

  return (
    <div className="pointer-events-none absolute inset-0 text-white text-xs font-mono">
      {/* not-tall: on short overlay screens (phone landscape) the right
          column otherwise descends into the gimbal pad's corner — tighten
          the stack there only; both rows shift together to stay aligned. */}
      <div className="absolute top-4 left-4 flex items-center gap-2 @hud:not-tall:top-2">
        <ArmedChip armed={droneState.armed} />
        {droneState.flightMode && <HudChip>{droneState.flightMode}</HudChip>}
      </div>
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2 @hud:not-tall:top-2 @hud:not-tall:gap-1">
        <div className="hidden @hud:block">
          <LinkIndicators
            telemetryHealth={droneState.telemetryHealth}
            controlHealth={controlHealthFrom(
              controlStatus,
              droneState.telemetryHealth,
            )}
            fcLinkHealth={droneState.fcLinkHealth}
            videoHealth={droneState.videoHealth}
          />
        </div>
        <div className="hidden @hud:block">
          <GpsReadout gps={mavlink?.gps ?? null} stale={stale} />
        </div>
        <BatteryReadout
          percentage={mavlink?.battery_percentage ?? null}
          flightTimeRemainingS={mavlink?.flight_time_remaining ?? null}
          stale={stale}
        />
        {/* Corner-stack altitude chip — the default. The instrument tile
            takes over only when the viewport is wide AND tall enough for
            its right-edge slot (see `tall` in index.css). */}
        <HudChip
          className={cn("@hud:tall:hidden", stale && "opacity-60")}
          label="ALT"
          value={
            mavlink?.position?.rel_alt != null
              ? mavlink.position.rel_alt.toFixed(1)
              : "—"
          }
          unit="m"
        />
      </div>
      {/* Wide AND tall: right-edge instrument slot (the altitude-tape
          convention). Below 400px of height a 55px tile has no valid
          position between the diagnostics column and the gimbal pad. */}
      <div
        className={cn(
          "hidden @hud:tall:block absolute right-4 top-[40%] -translate-y-1/2",
          stale && "opacity-60",
        )}
      >
        <Altimeter relAltMeters={mavlink?.position?.rel_alt ?? null} />
      </div>
    </div>
  )
}

/**
 * Diagnostics (link health + GPS) for narrow layouts, centered rows meant
 * to sit below the picture — hidden at @hud+, where the overlay's
 * top-right column shows them instead.
 */
export function TelemetryStrip({
  telemetry,
  droneState,
  controlStatus,
}: TelemetryHudProps) {
  const mavlink = telemetry?.mavlink_telemetry ?? null

  return (
    <div className="@hud:hidden flex flex-col items-center gap-1.5 px-3 pt-2 text-white text-xs font-mono">
      <LinkIndicators
        telemetryHealth={droneState.telemetryHealth}
        controlHealth={controlHealthFrom(
          controlStatus,
          droneState.telemetryHealth,
        )}
        fcLinkHealth={droneState.fcLinkHealth}
        videoHealth={droneState.videoHealth}
      />
      <GpsReadout
        gps={mavlink?.gps ?? null}
        stale={droneState.telemetryHealth !== "live"}
      />
    </div>
  )
}

function controlHealthFrom(
  controlStatus: SocketStatus | undefined,
  telemetryHealth: TelemetryHealth,
): "ok" | "stale" | "down" | undefined {
  if (controlStatus === undefined) return undefined
  if (controlStatus !== "open") return "down"

  // An open socket says nothing about delivery — with the drone silent,
  // frames vanish into a subscriber-less relay. Green would overpromise.
  return telemetryHealth === "live" ? "ok" : "stale"
}

/** Color = hazard level: armed (live props) is red, disarmed green. */
function ArmedChip({ armed }: { armed: boolean | null }) {
  return (
    <HudChip
      dot={
        armed == null ? "bg-zinc-500" : armed ? "bg-red-500" : "bg-green-500"
      }
    >
      {/* Armed is the one safety-critical state — the word carries the
          hazard color, not just the dot. */}
      <span className={cn(armed && "font-semibold text-red-400")}>
        {armed == null ? "—" : armed ? "ARMED" : "DISARMED"}
      </span>
    </HudChip>
  )
}

function GpsReadout({ gps, stale }: { gps: Gps | null; stale: boolean }) {
  const fix = gps?.fix_type ? gps.fix_type.replace("FIX_TYPE_", "") : null

  return (
    <HudChip
      variant="adaptive"
      label="SAT"
      value={gps?.num_satellites ?? "—"}
      className={cn(stale && "opacity-60")}
    >
      {fix && <span className="text-white/70">· {fix}</span>}
    </HudChip>
  )
}

function BatteryReadout({
  percentage,
  flightTimeRemainingS,
  stale,
}: {
  percentage: number | null
  flightTimeRemainingS: number | null
  stale: boolean
}) {
  const pct = percentage != null ? formatBatteryPercent(percentage) : null

  return (
    <HudChip
      dot={stale ? "bg-zinc-500" : batteryDotColor(pct)}
      label="BAT"
      value={pct != null ? `${pct}%` : "—"}
      className={cn(stale && "opacity-60")}
    >
      {flightTimeRemainingS != null && (
        <span className="text-white/70 tabular-nums">
          · {formatDuration(flightTimeRemainingS)}
        </span>
      )}
    </HudChip>
  )
}

/** Mirrors PX4's failsafe ladder (BAT_LOW_THR 15%, BAT_CRIT_THR 7%) plus a
 * 30% operational-reserve band — red means the FC itself is now warning. */
function batteryDotColor(pct: number | null): string {
  if (pct == null) return "bg-zinc-500"
  if (pct <= 7) return "bg-red-500 animate-pulse"
  if (pct <= 15) return "bg-red-500"
  if (pct <= 30) return "bg-amber-500"
  return "bg-green-500"
}

/** mavsdk reports remaining battery as a 0..1 fraction; tolerate either. */
function formatBatteryPercent(value: number): number {
  return Math.round(value <= 1 ? value * 100 : value)
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.max(0, Math.floor(seconds % 60))
  return `${m}:${String(s).padStart(2, "0")}`
}
