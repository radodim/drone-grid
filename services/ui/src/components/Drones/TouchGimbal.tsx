import { useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface TouchGimbalProps {
  /** Knob position while not being dragged, in [-1, 1] axis space. A sticky
   * throttle is expressed by feeding the held value back in here. */
  restX: number
  restY: number
  /** Fired continuously while dragging; x right-positive, y up-positive,
   * both independently clamped to [-1, 1] (square gate, corners reachable). */
  onMove?: (x: number, y: number) => void
  onRelease?: () => void
  /** false renders a read-only visualizer: no pointer handling, knob just
   * follows rest{X,Y}. */
  interactive?: boolean
  label?: string
}

const PAD_SIZE_PX = 144
const KNOB_SIZE_PX = 36 // keep in sync with the knob's size-9
// The knob stays inside the gate: full deflection means touching the edge,
// never crossing it — otherwise it clips on container bounds and covers
// the caption at sticky-100% throttle.
const KNOB_INSET_PCT = (KNOB_SIZE_PX / 2 / PAD_SIZE_PX) * 100
const KNOB_TRAVEL_PCT = 100 - 2 * KNOB_INSET_PCT

/**
 * One square RC-style gimbal pad. Unlike a round joystick, X and Y clamp
 * independently — full deflection in both axes at once, like a real
 * transmitter gimbal. Spring-back vs stickiness is the parent's call: the
 * knob renders at rest{X,Y} whenever the finger is up.
 */
export function TouchGimbal({
  restX,
  restY,
  onMove,
  onRelease,
  interactive = true,
  label,
}: TouchGimbalProps) {
  const padRef = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null)

  const x = drag ? drag.x : restX
  const y = drag ? drag.y : restY

  const positionFromPointer = (
    e: React.PointerEvent,
  ): { x: number; y: number } => {
    const pad = padRef.current
    if (pad == null) return { x: 0, y: 0 }
    const rect = pad.getBoundingClientRect()
    const half = rect.width / 2
    return {
      x: clamp((e.clientX - rect.left - half) / half),
      y: clamp(-(e.clientY - rect.top - half) / half),
    }
  }

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = positionFromPointer(e)
    setDrag(pos)
    onMove?.(pos.x, pos.y)
  }

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag == null) return
    const pos = positionFromPointer(e)
    setDrag(pos)
    onMove?.(pos.x, pos.y)
  }

  const handleUp = () => {
    if (drag == null) return
    setDrag(null)
    onRelease?.()
  }

  return (
    <div
      ref={padRef}
      onPointerDown={interactive ? handleDown : undefined}
      onPointerMove={interactive ? handleMove : undefined}
      onPointerUp={interactive ? handleUp : undefined}
      onPointerCancel={interactive ? handleUp : undefined}
      style={{ width: PAD_SIZE_PX, height: PAD_SIZE_PX }}
      className={cn(
        // Narrow: sits on the control deck (black), needs a lifted surface;
        // wide: overlays video, needs a dark scrim instead.
        "relative rounded-lg border border-white/15 bg-white/5 select-none",
        "@hud:border-white/30 @hud:bg-black/40",
        interactive
          ? "pointer-events-auto touch-none"
          : "pointer-events-none opacity-80",
      )}
    >
      {/* center crosshair */}
      <div className="absolute left-1/2 top-0 h-full w-px bg-white/15" />
      <div className="absolute top-1/2 left-0 w-full h-px bg-white/15" />
      <div
        className={cn(
          "absolute size-9 rounded-full bg-white/70 shadow",
          interactive && drag == null && "transition-[left,top] duration-150",
        )}
        style={{
          left: `${KNOB_INSET_PCT + ((x + 1) / 2) * KNOB_TRAVEL_PCT}%`,
          top: `${KNOB_INSET_PCT + ((1 - y) / 2) * KNOB_TRAVEL_PCT}%`,
          transform: "translate(-50%, -50%)",
        }}
      />
      {label && (
        // Below the pad — safe again now that the knob stays inside the gate.
        <div className="absolute -bottom-5 inset-x-0 text-center text-[10px] font-mono text-white/50">
          {label}
        </div>
      )}
    </div>
  )
}

function clamp(value: number): number {
  return Math.min(1, Math.max(-1, value))
}
