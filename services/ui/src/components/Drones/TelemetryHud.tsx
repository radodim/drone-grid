import { Altimeter } from "@/components/Drones/Altimeter"
import { LinkIndicators } from "@/components/Drones/LinkIndicators"
import type { DroneState } from "@/hooks/useDroneState"
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
 * clear. On @2xl+ containers the top-right column also carries the
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

  return (
    <div className="pointer-events-none absolute inset-0 text-white text-xs font-mono">
      <div className="absolute top-4 left-4 flex items-center gap-2">
        <ArmedChip armed={droneState.armed} />
        {droneState.flightMode && (
          <div className="bg-black/60 rounded px-2 py-1">
            {droneState.flightMode}
          </div>
        )}
      </div>
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <div className="hidden @2xl:block">
          <LinkIndicators
            telemetryHealth={droneState.telemetryHealth}
            controlHealth={controlHealthFrom(controlStatus)}
            fcLinkHealth={droneState.fcLinkHealth}
            videoHealth={droneState.videoHealth}
          />
        </div>
        <div className="hidden @2xl:block">
          <GpsReadout gps={mavlink?.gps ?? null} />
        </div>
        <BatteryReadout
          percentage={mavlink?.battery_percentage ?? null}
          flightTimeRemainingS={mavlink?.flight_time_remaining ?? null}
        />
        {/* Narrow: altitude joins the corner stack — a lone chip floating
            mid-edge is the most intrusive spot on a small picture. */}
        <div className="bg-black/60 rounded px-2 py-1 @2xl:hidden flex items-baseline gap-1.5">
          <span className="text-white/70">ALT</span>
          <span className="text-sm font-semibold tabular-nums">
            {mavlink?.position?.rel_alt != null
              ? mavlink.position.rel_alt.toFixed(1)
              : "—"}
          </span>
          <span className="text-white/70">m</span>
        </div>
      </div>
      {/* Wide: right-edge instrument slot (the altitude-tape convention),
          raised above center so short-viewport landscape clears the pad. */}
      <div className="hidden @2xl:block absolute right-4 top-[40%] -translate-y-1/2">
        <Altimeter relAltMeters={mavlink?.position?.rel_alt ?? null} />
      </div>
    </div>
  )
}

/**
 * Diagnostics (link health + GPS) for narrow layouts, centered rows meant
 * to sit below the picture — hidden at @2xl+, where the overlay's
 * top-right column shows them instead.
 */
export function TelemetryStrip({
  telemetry,
  droneState,
  controlStatus,
}: TelemetryHudProps) {
  const mavlink = telemetry?.mavlink_telemetry ?? null

  return (
    <div className="@2xl:hidden flex flex-col items-center gap-1.5 px-3 pt-2 text-white text-xs font-mono">
      <LinkIndicators
        telemetryHealth={droneState.telemetryHealth}
        controlHealth={controlHealthFrom(controlStatus)}
        fcLinkHealth={droneState.fcLinkHealth}
        videoHealth={droneState.videoHealth}
      />
      <GpsReadout gps={mavlink?.gps ?? null} />
    </div>
  )
}

function controlHealthFrom(
  controlStatus: SocketStatus | undefined,
): "ok" | "down" | undefined {
  if (controlStatus === undefined) return undefined

  return controlStatus === "open" ? "ok" : "down"
}

/** Color = hazard level: armed (live props) is red, disarmed green. */
function ArmedChip({ armed }: { armed: boolean | null }) {
  return (
    <div className="bg-black/60 rounded px-2 py-1 flex items-center gap-2">
      <span
        className={cn(
          "inline-block size-2 rounded-full",
          armed == null ? "bg-zinc-500" : armed ? "bg-red-500" : "bg-green-500",
        )}
      />
      {/* Armed is the one safety-critical state — the word carries the
          hazard color, not just the dot. */}
      <span className={cn(armed && "font-semibold text-red-400")}>
        {armed == null ? "—" : armed ? "ARMED" : "DISARMED"}
      </span>
    </div>
  )
}

function GpsReadout({ gps }: { gps: Gps | null }) {
  const fix = gps?.fix_type ? gps.fix_type.replace("FIX_TYPE_", "") : null

  return (
    // Narrow: lives on the control deck (black) — scrim would be invisible.
    <div className="bg-white/5 @2xl:bg-black/60 rounded px-2 py-1 flex items-baseline gap-1.5">
      <span className="text-white/70">SAT</span>
      <span className="text-sm font-semibold tabular-nums">
        {gps?.num_satellites ?? "—"}
      </span>
      {fix && <span className="text-white/70">· {fix}</span>}
    </div>
  )
}

function BatteryReadout({
  percentage,
  flightTimeRemainingS,
}: {
  percentage: number | null
  flightTimeRemainingS: number | null
}) {
  const pct = percentage != null ? formatBatteryPercent(percentage) : null

  return (
    <div className="bg-black/60 rounded px-2 py-1 flex items-baseline gap-1.5">
      <span
        className={cn(
          "self-center inline-block size-2 rounded-full",
          batteryDotColor(pct),
        )}
      />
      <span className="text-white/70">BAT</span>
      <span className="text-sm font-semibold tabular-nums">
        {pct != null ? `${pct}%` : "—"}
      </span>
      {flightTimeRemainingS != null && (
        <span className="text-white/70 tabular-nums">
          · {formatDuration(flightTimeRemainingS)}
        </span>
      )}
    </div>
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
