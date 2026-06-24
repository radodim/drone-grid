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
 * Corner-cluster telemetry overlay: armed + flight mode top-left, link
 * health + GPS + battery top-right, altitude on the right edge. The video
 * center stays clear. Each element carries exactly one non-derivable fact
 * and renders dashes when data is missing. Companion state is deliberately
 * not rendered — it's derivable from TELEM + DRONE.
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
        <LinkIndicators
          telemetryHealth={droneState.telemetryHealth}
          controlHealth={
            controlStatus === undefined
              ? undefined
              : controlStatus === "open"
                ? "ok"
                : "down"
          }
          fcLinkHealth={droneState.fcLinkHealth}
          videoHealth={droneState.videoHealth}
        />
        <GpsReadout gps={mavlink?.gps ?? null} />
        <BatteryReadout
          percentage={mavlink?.battery_percentage ?? null}
          flightTimeRemainingS={mavlink?.flight_time_remaining ?? null}
        />
      </div>
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <Altimeter relAltMeters={mavlink?.position?.rel_alt ?? null} />
      </div>
    </div>
  )
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
      {armed == null ? "—" : armed ? "ARMED" : "DISARMED"}
    </div>
  )
}

function GpsReadout({ gps }: { gps: Gps | null }) {
  const fix = gps?.fix_type ? gps.fix_type.replace("FIX_TYPE_", "") : null

  return (
    <div className="bg-black/60 rounded px-2 py-1">
      SAT {gps?.num_satellites ?? "—"}
      {fix ? ` · ${fix}` : ""}
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
    <div className="bg-black/60 rounded px-2 py-1 flex items-center gap-2">
      <span
        className={cn("inline-block size-2 rounded-full", batteryDotColor(pct))}
      />
      BAT {pct != null ? `${pct}%` : "—"}
      {flightTimeRemainingS != null
        ? ` · ${formatDuration(flightTimeRemainingS)}`
        : ""}
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
