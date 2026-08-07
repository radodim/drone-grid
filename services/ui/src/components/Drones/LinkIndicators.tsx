import type {
  FcLinkHealth,
  TelemetryHealth,
  VideoHealth,
} from "@/hooks/useDroneState"
import { cn } from "@/lib/utils"

interface LinkIndicatorsProps {
  telemetryHealth: TelemetryHealth
  /** Omitted for read-only share viewers — they hold no control channel. */
  controlHealth?: "ok" | "down"
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

/** Health dots for the transport segments. CTRL (when present) is the only
 * witness to "HUD healthy but sticks dead"; FC is companion-clock derived,
 * so it's immune to browser clock skew. */
export function LinkIndicators({
  telemetryHealth,
  controlHealth,
  fcLinkHealth,
  videoHealth,
}: LinkIndicatorsProps) {
  return (
    <div className="pointer-events-auto cursor-default flex gap-2 text-xs font-mono">
      {controlHealth && (
        <HealthDot
          label="CTRL"
          state={controlHealth}
          title="Control channel health"
        />
      )}
      <HealthDot
        label="FC"
        state={fcLinkHealth}
        title="Flight controller link health"
      />
      <HealthDot
        label="TELEM"
        state={telemetryHealth}
        title="Telemetry feed health"
      />
      <HealthDot
        label="VIDEO"
        state={videoHealth}
        title="Video stream health"
      />
    </div>
  )
}

function HealthDot({
  label,
  state,
  title,
}: {
  label: string
  state: string
  title: string
}) {
  return (
    <div
      title={title}
      // Narrow: on the control deck (black), where a black scrim vanishes;
      // wide: over video, where the scrim earns its keep.
      className="bg-white/5 @2xl:bg-black/60 text-white rounded px-2 py-1 flex items-center gap-2"
    >
      <span
        className={cn("inline-block size-2 rounded-full", DOT_COLOR[state])}
      />
      {label}
    </div>
  )
}
