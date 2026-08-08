import { Maximize, Minimize } from "lucide-react"

import { cn } from "@/lib/utils"

/** Corner toggle for a player container. Renders nothing where element
 * fullscreen is unsupported (iPhone Safari) — a dead button is worse than
 * no button. */
export function FullscreenToggle({
  isFullscreen,
  onToggle,
  className,
}: {
  isFullscreen: boolean
  onToggle: () => void
  className?: string
}) {
  if (!document.fullscreenEnabled) return null

  const label = isFullscreen ? "Exit fullscreen" : "Fullscreen"

  return (
    <button
      type="button"
      onClick={onToggle}
      title={label}
      aria-label={label}
      className={cn(
        "rounded p-2.5 text-white",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60",
        className,
      )}
    >
      {isFullscreen ? (
        <Minimize className="size-4" />
      ) : (
        <Maximize className="size-4" />
      )}
    </button>
  )
}
