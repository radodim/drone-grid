import { useEffect, useRef, useState } from "react"

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
const KNOB_SIZE_PX = 40 // keep in sync with the knob's size-10
// The knob stays inside the gate: full deflection means touching the edge,
// never crossing it — otherwise it clips on container bounds and covers
// the caption at sticky-100% throttle.
const KNOB_INSET_PCT = (KNOB_SIZE_PX / 2 / PAD_SIZE_PX) * 100
const KNOB_TRAVEL_PCT = 100 - 2 * KNOB_INSET_PCT

/** Touch slop: the grab circle is this × knob radius, so fat fingers can
 * catch the knob without aiming pixel-perfect. Exported for tests. */
export const GRAB_SLOP = 1.6

/** Pure knob geometry — axis space [-1, 1] to pad-relative CSS percent,
 * keeping the knob inside the gate. Exported for tests. */
export function knobPositionPct(
  x: number,
  y: number,
): { left: number; top: number } {
  return {
    left: KNOB_INSET_PCT + ((x + 1) / 2) * KNOB_TRAVEL_PCT,
    top: KNOB_INSET_PCT + ((1 - y) / 2) * KNOB_TRAVEL_PCT,
  }
}

/** Grab test at pointerdown: px offset pointer→knob-center when the touch
 * lands on the knob (+ slop), null when it missed — a miss must be inert,
 * never a teleport. Pointer is px within the pad. Exported for tests. */
export function grabOffset(
  pointer: { x: number; y: number },
  knob: { x: number; y: number },
  padSizePx: number,
): { dx: number; dy: number } | null {
  const pos = knobPositionPct(knob.x, knob.y)
  const dx = pointer.x - (pos.left / 100) * padSizePx
  const dy = pointer.y - (pos.top / 100) * padSizePx
  if (Math.hypot(dx, dy) > (KNOB_SIZE_PX / 2) * GRAB_SLOP) return null

  return { dx, dy }
}

/** Knob-center px within the pad → axis value; the inverse of
 * knobPositionPct, so a dragged knob tracks the finger exactly and clamps
 * where the gate physically stops it. Exported for tests. */
export function valueFromKnobCenter(
  pxX: number,
  pxY: number,
  padSizePx: number,
): { x: number; y: number } {
  const pctX = (pxX / padSizePx) * 100
  const pctY = (pxY / padSizePx) * 100
  return {
    x: clamp(((pctX - KNOB_INSET_PCT) / KNOB_TRAVEL_PCT) * 2 - 1),
    y: clamp(1 - ((pctY - KNOB_INSET_PCT) / KNOB_TRAVEL_PCT) * 2),
  }
}

/**
 * One square RC-style gimbal pad. Unlike a round joystick, X and Y clamp
 * independently — full deflection in both axes at once, like a real
 * transmitter gimbal. Spring-back vs stickiness is the parent's call: the
 * knob renders at rest{X,Y} whenever the finger is up. The knob must be
 * GRABBED to move — pointerdown anywhere else on the pad is inert, so a
 * stray tap can't teleport the stick into a live command.
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
  const [drag, setDrag] = useState<{
    pointerId: number
    dx: number
    dy: number
    x: number
    y: number
  } | null>(null)

  const x = drag ? drag.x : restX
  const y = drag ? drag.y : restY

  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag != null) return // one finger owns the stick; ignore a second
    const pad = padRef.current
    if (pad == null) return
    const rect = pad.getBoundingClientRect()
    // Hit-test the RENDERED knob position — a parked sticky throttle must
    // be grabbable where it's parked, not at center.
    const off = grabOffset(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      { x, y },
      rect.width,
    )
    if (off == null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDrag({ pointerId: e.pointerId, dx: off.dx, dy: off.dy, x, y })
    // Current value, not the touch point: grabbing never changes the command.
    onMove?.(x, y)
  }

  const handleMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag == null || e.pointerId !== drag.pointerId) return
    const pad = padRef.current
    if (pad == null) return
    const rect = pad.getBoundingClientRect()
    // Keep the grab offset so the knob follows the finger without jumping.
    const pos = valueFromKnobCenter(
      e.clientX - rect.left - drag.dx,
      e.clientY - rect.top - drag.dy,
      rect.width,
    )
    setDrag({ ...drag, x: pos.x, y: pos.y })
    onMove?.(pos.x, pos.y)
  }

  const handleUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (drag == null || e.pointerId !== drag.pointerId) return
    setDrag(null)
    onRelease?.()
  }

  // A pad that can no longer service a live drag must release its claim:
  // interactive flips false when another source takes over mid-drag, and
  // without a release the deflection stays stored in the input source,
  // resurfacing as a live command on the next switch back to touch.
  const dragRef = useRef(drag)
  dragRef.current = drag
  const onReleaseRef = useRef(onRelease)
  onReleaseRef.current = onRelease
  useEffect(() => {
    if (interactive || dragRef.current == null) return
    setDrag(null)
    onReleaseRef.current?.()
  }, [interactive])
  // Same contract on unmount.
  useEffect(() => {
    return () => {
      if (dragRef.current != null) onReleaseRef.current?.()
    }
  }, [])

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
          "absolute size-10 rounded-full bg-white/70 shadow",
          interactive &&
            drag == null &&
            "transition-[left,top] duration-150 motion-reduce:transition-none",
        )}
        style={{
          left: `${knobPositionPct(x, y).left}%`,
          top: `${knobPositionPct(x, y).top}%`,
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

/** Exported for tests. */
export function clamp(value: number): number {
  return Math.min(1, Math.max(-1, value))
}
