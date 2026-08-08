import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface HudChipProps {
  /** "overlay" chips always sit on video and keep the dark scrim; "adaptive"
   * chips live on the narrow control deck (where a scrim vanishes on black)
   * and only scrim once the @hud overlay puts them over video. */
  variant?: "overlay" | "adaptive"
  /** Status-dot color class (e.g. "bg-green-500"); omitted = no dot. */
  dot?: string
  label?: string
  value?: ReactNode
  unit?: string
  title?: string
  className?: string
  children?: ReactNode
}

/** One HUD chip: mono, dot + dimmed label + bright tabular value. The
 * shared voice of every readout on and around the video. */
export function HudChip({
  variant = "overlay",
  dot,
  label,
  value,
  unit,
  title,
  className,
  children,
}: HudChipProps) {
  return (
    <div
      title={title}
      className={cn(
        "rounded px-2 py-1 text-white flex items-baseline gap-1.5",
        variant === "overlay" ? "bg-black/60" : "bg-white/5 @hud:bg-black/60",
        className,
      )}
    >
      {dot && (
        <span
          className={cn(
            "self-center inline-block size-2 rounded-full motion-reduce:animate-none",
            dot,
          )}
        />
      )}
      {label && <span className="text-white/70">{label}</span>}
      {value != null && (
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      )}
      {unit && <span className="text-white/70">{unit}</span>}
      {children}
    </div>
  )
}
