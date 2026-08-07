import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Maximize, Minimize } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import "@/lib/mediamtx-reader"
import { DronesService } from "@/client"
import { DroneControls } from "@/components/Drones/DroneControls"
import { ShareDialog } from "@/components/Drones/ShareDialog"
import { TelemetryHud, TelemetryStrip } from "@/components/Drones/TelemetryHud"
import { Button } from "@/components/ui/button"
import { useControlInput } from "@/hooks/useControlInput"
import { useControlSocket } from "@/hooks/useControlSocket"
import { useDroneState } from "@/hooks/useDroneState"
import { useTelemetrySocket } from "@/hooks/useTelemetrySocket"
import keycloak from "@/keycloak"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/drones_/$droneId")({
  component: DroneStream,
  head: () => ({
    meta: [{ title: "Live Stream - Drone Grid" }],
  }),
})

/** Container width the control overlay needs — keep equal to the @hud
 * container breakpoint (--container-hud in index.css). */
const OVERLAY_MIN_WIDTH_PX = 640

function DroneStream() {
  const { droneId } = Route.useParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  // The element must not assert a ratio the stream doesn't have (the Pi
  // camera pushes 4:3) — track the real one; 16:9 is only the pre-metadata
  // placeholder. WebRTC may change resolution mid-session ('resize' event).
  const [streamAspect, setStreamAspect] = useState("16 / 9")
  const updateStreamAspect = () => {
    const video = videoRef.current
    if (video && video.videoWidth > 0 && video.videoHeight > 0) {
      setStreamAspect(`${video.videoWidth} / ${video.videoHeight}`)
    }
  }
  const {
    telemetry,
    status: telemetryStatus,
    lastMessageAt,
  } = useTelemetrySocket(droneId)
  const controlInput = useControlInput(
    telemetry?.mavlink_telemetry?.is_armed === false,
  )
  // Owned here (not in DroneControls) so the HUD's CTRL chip and the
  // command stream share one socket.
  const control = useControlSocket(droneId)
  // Header identity: the drone's name beats a generic "Live Stream" label.
  // Same key as the list page, so navigating from there hits cache.
  const dronesQuery = useQuery({
    queryKey: ["drones"],
    queryFn: () => DronesService.listDrones(),
  })
  const droneName = dronesQuery.data?.find((d) => d.id === droneId)?.name
  const droneState = useDroneState({
    telemetry,
    lastMessageAt,
    socketStatus: telemetryStatus,
    videoError: error,
    throttleSafeToArm: controlInput.throttleSafeToArm,
  })

  // Surface degradations as toasts (video errors already toast on arrival).
  const prevHealthRef = useRef({
    telemetry: droneState.telemetryHealth,
    fcLink: droneState.fcLinkHealth,
  })
  useEffect(() => {
    const prev = prevHealthRef.current
    if (droneState.telemetryHealth !== "live" && prev.telemetry === "live") {
      toast.error("Telemetry lost", {
        description: "No telemetry is arriving from the backend.",
      })
    }
    if (droneState.fcLinkHealth === "stale" && prev.fcLink === "ok") {
      toast.warning("Drone link degraded", {
        description: "The companion can't reach the flight controller.",
      })
    }
    prevHealthRef.current = {
      telemetry: droneState.telemetryHealth,
      fcLink: droneState.fcLinkHealth,
    }
  }, [droneState.telemetryHealth, droneState.fcLinkHealth])

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
  }, [])

  // Fullscreen the container (not the <video>) so the HUD and controls
  // stay visible.
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
      return
    }
    await containerRef.current?.requestFullscreen()
    // Phones only (short side below the overlay threshold): rotating is the
    // device's sole path to an overlay-capable width, and holding the lock
    // keeps the control layout from reshuffling under the pilot's thumbs.
    // Tablets are never locked — their portrait already fits the overlay.
    // Unsupported (iOS/desktop) rejects and the width-gated layout applies.
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

  useEffect(() => {
    const whepUrl = `${import.meta.env.VITE_WEBRTC_URL}/${droneId}/whep`

    readerRef.current = new (window as any).MediaMTXWebRTCReader({
      url: whepUrl,
      token: keycloak.token || "",
      onError: (err: string) => {
        console.error("WebRTC reader error:", err)
        setError(err)
        toast.error("Stream error", { description: err })
      },
      onTrack: (evt: RTCTrackEvent) => {
        if (videoRef.current) {
          videoRef.current.srcObject = evt.streams[0]
        }
      },
    })

    return () => {
      if (readerRef.current) {
        readerRef.current.close()
        readerRef.current = null
      }
    }
  }, [droneId])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/drones">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="flex-1 truncate text-2xl font-bold tracking-tight">
          {droneName ?? "Live Stream"}
        </h1>
        <ShareDialog droneId={droneId} />
      </div>
      {/* @container: the controls/HUD gate on THIS element's width, so the
          inline card, fullscreen, and any sidebar-squeezed layout all
          resolve correctly without media queries. */}
      <div
        ref={containerRef}
        className={cn(
          "@container relative rounded-lg overflow-hidden border bg-black flex flex-col",
          isFullscreen && "rounded-none border-0",
        )}
      >
        {/* HUD scopes to the video area; stacked controls flow below it. */}
        <div
          className={cn(
            "relative",
            isFullscreen && "flex-1 min-h-0 flex items-center justify-center",
          )}
        >
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            onLoadedMetadata={updateStreamAspect}
            onResize={updateStreamAspect}
            style={{ aspectRatio: streamAspect }}
            className={cn(
              // block: inline videos add a phantom baseline gap below.
              "block w-full",
              isFullscreen && "max-h-full object-contain",
            )}
          />
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80">
              <p className="text-destructive text-sm">{error}</p>
            </div>
          )}
          <TelemetryHud
            telemetry={telemetry}
            droneState={droneState}
            controlStatus={control.status}
          />
          <button
            type="button"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="absolute bottom-4 right-4 rounded bg-black/60 p-2 text-white"
          >
            {isFullscreen ? (
              <Minimize className="size-4" />
            ) : (
              <Maximize className="size-4" />
            )}
          </button>
        </div>
        {/* Narrow: the "control deck" — hairline seam + a one-step surface
            lift so the console reads apart from the screen. @hud:contents
            dissolves the wrapper so DroneControls overlays the container. */}
        <div className="border-t border-white/15 bg-white/4 @hud:contents">
          <TelemetryStrip
            telemetry={telemetry}
            droneState={droneState}
            controlStatus={control.status}
          />
          <DroneControls
            droneState={droneState}
            controlInput={controlInput}
            control={control}
          />
        </div>
      </div>
    </div>
  )
}
