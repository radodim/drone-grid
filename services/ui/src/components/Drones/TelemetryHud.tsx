import { Altimeter } from "@/components/Drones/Altimeter"
import { LinkIndicators } from "@/components/Drones/LinkIndicators"
import type { DroneState } from "@/hooks/useDroneState"
import { cn } from "@/lib/utils"
import type { Gps, Telemetry } from "@/types/telemetry"

interface TelemetryHudProps {
  telemetry: Telemetry | null
  droneState: DroneState
}

/**
 * Corner-cluster telemetry overlay: status top-left, link health + GPS
 * top-right, battery bottom-left, altitude on the right edge. The video
 * center stays clear. Each instrument reads its own telemetry slice and
 * renders dashes when data is missing.
 */
export function TelemetryHud({ telemetry, droneState }: TelemetryHudProps) {
  const mavlink = telemetry?.mavlink_telemetry ?? null

  return (
    <div className="pointer-events-none absolute inset-0 text-white text-xs font-mono">
      <div className="absolute top-4 left-4">
        <StatusBadge droneState={droneState} />
      </div>
      <div className="absolute top-4 right-4 flex flex-col items-end gap-2">
        <LinkIndicators
          telemetryHealth={droneState.telemetryHealth}
          fcLinkHealth={droneState.fcLinkHealth}
          videoHealth={droneState.videoHealth}
        />
        <GpsReadout gps={mavlink?.gps ?? null} />
      </div>
      <div className="absolute bottom-4 left-4">
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

function StatusBadge({ droneState }: { droneState: DroneState }) {
  const { companionState, armed, flightMode } = droneState
  const pieces = [
    (companionState ?? "no telemetry").toUpperCase(),
    armed == null ? null : armed ? "ARMED" : "DISARMED",
    flightMode,
  ].filter(Boolean)

  return (
    <div className="bg-black/60 rounded px-2 py-1 flex items-center gap-2">
      {armed != null && (
        <span
          className={cn(
            "inline-block size-2 rounded-full",
            armed ? "bg-red-500" : "bg-green-500",
          )}
        />
      )}
      {pieces.join("  ")}
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
  return (
    <div className="bg-black/60 rounded px-2 py-1">
      BAT {percentage != null ? `${formatBatteryPercent(percentage)}%` : "—"}
      {flightTimeRemainingS != null
        ? ` · ${formatDuration(flightTimeRemainingS)}`
        : ""}
    </div>
  )
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
