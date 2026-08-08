import { useEffect, useState } from "react"

/** Container width the control overlay needs — keep equal to the @hud
 * container breakpoint (--container-hud in index.css). */
const OVERLAY_MIN_WIDTH_PX = 640

/**
 * Fullscreen for the player container, with landscape orientation-lock on
 * devices whose short side can't fit the control overlay (phones): rotating
 * is their only path to an overlay-capable width, and holding the lock
 * keeps the layout from reshuffling under the pilot's thumbs. Tablets are
 * never locked — their portrait already fits. Where lock() is unsupported
 * (iOS/desktop) the width-gated layout is the fallback.
 */
export function useFullscreenLandscapeLock(
  containerRef: React.RefObject<HTMLDivElement | null>,
): { isFullscreen: boolean; toggleFullscreen: () => Promise<void> } {
  const [isFullscreen, setIsFullscreen] = useState(false)

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === containerRef.current
      setIsFullscreen(active)
      if (!active) {
        try {
          screen.orientation.unlock()
        } catch {
          // never locked, or unsupported (iOS/desktop)
        }
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [containerRef])

  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
      return
    }
    await containerRef.current?.requestFullscreen()
    if (Math.min(screen.width, screen.height) < OVERLAY_MIN_WIDTH_PX) {
      try {
        // lib.dom omits lock() (Firefox desktop lacks it) — feature-detect.
        const orientation = screen.orientation as ScreenOrientation & {
          lock?: (orientation: "landscape") => Promise<void>
        }
        await orientation.lock?.("landscape")
      } catch {
        // fall through to the stacked fullscreen layout
      }
    }
  }

  return { isFullscreen, toggleFullscreen }
}
