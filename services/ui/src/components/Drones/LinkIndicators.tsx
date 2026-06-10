import type {
  FcLinkHealth,
  TelemetryHealth,
  VideoHealth,
} from "@/hooks/useDroneState"
import { cn } from "@/lib/utils"

interface LinkIndicatorsProps {
  telemetryHealth: TelemetryHealth
  fcLinkHealth: FcLinkHealth
  videoHealth: VideoHealth
}

const DOT_COLOR: Record<string, string> = {
  live: "bg-green-500",
  ok: "bg-green-500",
  stale: "bg-amber-500",
  down: "bg-red-500",
  error: "bg-red-500",
  unknown: "bg-zinc-500",
}

/** Tri-state health dots for the three liveness domains:
 * telemetry transport, companion→FC link, and the video stream. */
export function LinkIndicators({
  telemetryHealth,
  fcLinkHealth,
  videoHealth,
}: LinkIndicatorsProps) {
  return (
    <div className="flex gap-2 text-xs font-mono">
      <HealthDot label="TELEM" state={telemetryHealth} />
      <HealthDot label="DRONE" state={fcLinkHealth} />
      <HealthDot label="VIDEO" state={videoHealth} />
    </div>
  )
}

function HealthDot({ label, state }: { label: string; state: string }) {
  return (
    <div className="bg-black/60 text-white rounded px-2 py-1 flex items-center gap-2">
      <span
        className={cn("inline-block size-2 rounded-full", DOT_COLOR[state])}
      />
      {label}
    </div>
  )
}
