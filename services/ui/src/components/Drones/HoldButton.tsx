import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

interface HoldButtonProps {
  label: string
  holdMs: number
  onComplete: () => void
  disabled: boolean
  disabledReason: string | null
  /** Fired when a disabled button is pressed — the touch-reachable channel
   * for disabledReason (title tooltips don't exist on touch). */
  onDisabledPress?: () => void
  variant: "arm" | "disarm"
}

const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

/**
 * Press-and-hold control: a progress ring fills while held and the action
 * fires only when the full hold duration elapses. Releasing (or leaving)
 * early cancels — deliberate by design for arm/disarm.
 */
export function HoldButton({
  label,
  holdMs,
  onComplete,
  disabled,
  disabledReason,
  onDisabledPress,
  variant,
}: HoldButtonProps) {
  const [progress, setProgress] = useState(0)
  const rafRef = useRef<number | null>(null)
  const firedRef = useRef(false)

  const stop = () => {
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    rafRef.current = null
    setProgress(0)
  }

  const start = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (disabled) {
      onDisabledPress?.()
      return
    }
    if (rafRef.current !== null) return
    e.currentTarget.setPointerCapture(e.pointerId)
    firedRef.current = false
    const startedAt = performance.now()

    const tick = (now: number) => {
      const p = Math.min((now - startedAt) / holdMs, 1)
      setProgress(p)
      if (p >= 1) {
        if (!firedRef.current) {
          firedRef.current = true
          onComplete()
        }
        stop()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)
    }
  }, [])

  const ringColor = variant === "arm" ? "stroke-red-500" : "stroke-amber-400"

  return (
    // Deliberately pointer-only: a keyboard "hold" is a weaker safety
    // gesture than a sustained physical press. aria-disabled (not disabled)
    // keeps the button pressable so a press can explain WHY it's inert.
    <button
      type="button"
      aria-disabled={disabled}
      title={disabled ? (disabledReason ?? undefined) : `Hold to ${label}`}
      onPointerDown={start}
      onPointerUp={stop}
      onPointerCancel={stop}
      // The 2s stationary hold is exactly a system long-press: suppress the
      // context menu / iOS callout it triggers, or the resulting pointercancel
      // resets the ring mid-hold on touch devices.
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        // Narrow: lifted surface on the control deck; wide: scrim over video.
        "pointer-events-auto relative size-16 rounded-full bg-white/10 @hud:bg-black/60 text-white",
        "text-[10px] font-mono select-none touch-none [-webkit-touch-callout:none]",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60",
        disabled && "opacity-50",
      )}
    >
      <svg
        className="absolute inset-0 size-full -rotate-90"
        viewBox="0 0 64 64"
        aria-hidden="true"
      >
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          className="stroke-white/20"
          strokeWidth="4"
        />
        <circle
          cx="32"
          cy="32"
          r={RADIUS}
          fill="none"
          className={ringColor}
          strokeWidth="4"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          strokeLinecap="round"
        />
      </svg>
      {label}
    </button>
  )
}
