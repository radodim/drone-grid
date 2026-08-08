import { HudChip } from "@/components/Drones/HudChip"
import type {
  FcLinkHealth,
  TelemetryHealth,
  VideoHealth,
} from "@/hooks/useDroneState"

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
    <HudChip
      variant="adaptive"
      dot={DOT_COLOR[state]}
      title={title}
      className="pointer-events-auto cursor-default"
    >
      {label}
    </HudChip>
  )
}
