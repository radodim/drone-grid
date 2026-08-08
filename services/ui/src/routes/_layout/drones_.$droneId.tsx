import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Maximize, Minimize } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import { DronesService } from "@/client"
import { DroneControls } from "@/components/Drones/DroneControls"
import { ShareDialog } from "@/components/Drones/ShareDialog"
import { TelemetryHud, TelemetryStrip } from "@/components/Drones/TelemetryHud"
import { Button } from "@/components/ui/button"
import { useSidebar } from "@/components/ui/sidebar"
import { useControlInput } from "@/hooks/useControlInput"
import { useControlSocket } from "@/hooks/useControlSocket"
import { useDroneState } from "@/hooks/useDroneState"
import { useFullscreenLandscapeLock } from "@/hooks/useFullscreenLandscapeLock"
import { useTelemetrySocket } from "@/hooks/useTelemetrySocket"
import { useWhepStream } from "@/hooks/useWhepStream"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/_layout/drones_/$droneId")({
  component: DroneStream,
  head: () => ({
    meta: [{ title: "Live Stream - Drone Grid" }],
  }),
})

function FullscreenToggle({
  isFullscreen,
  onToggle,
  className,
}: {
  isFullscreen: boolean
  onToggle: () => void
  className?: string
}) {
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

function DroneStream() {
  const { droneId } = Route.useParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { error } = useWhepStream(droneId, videoRef)
  // Fullscreen the container (not the <video>) so the HUD and controls
  // stay visible.
  const { isFullscreen, toggleFullscreen } =
    useFullscreenLandscapeLock(containerRef)
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

  // A cockpit wants canvas: enter with the sidebar collapsed (the rail and
  // trigger stay available), restore the visitor's state on leave. This
  // also keeps a nav toggle from shoving the player across the @hud
  // threshold and restructuring the controls mid-glance.
  const { open: sidebarOpen, setOpen: setSidebarOpen } = useSidebar()
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only — capture entry state, restore on leave
  useEffect(() => {
    const wasOpen = sidebarOpen
    setSidebarOpen(false)
    return () => setSidebarOpen(wasOpen)
  }, [])
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
          // Fullscreen owns the physical screen edges — keep controls clear
          // of gesture bars and notches (env() needs viewport-fit=cover).
          isFullscreen &&
            "rounded-none border-0 pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]",
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
              <p className="text-destructive text-sm">
                Video stream error — {error}
              </p>
            </div>
          )}
          <TelemetryHud
            telemetry={telemetry}
            droneState={droneState}
            controlStatus={control.status}
          />
          {/* Wide: conventional video-player corner. */}
          <FullscreenToggle
            isFullscreen={isFullscreen}
            onToggle={toggleFullscreen}
            className="hidden @hud:block absolute bottom-4 right-4 bg-black/60"
          />
        </div>
        {/* Narrow: the "control deck" — hairline seam + a one-step surface
            lift so the console reads apart from the screen. @hud:contents
            dissolves the wrapper so DroneControls overlays the container. */}
        <div className="relative border-t border-white/15 bg-white/4 @hud:contents">
          {/* Narrow: the deck's right edge, on the diagnostics line — the
              picture keeps zero interactive chrome, and the "go fly" button
              stays clear of the ARM/DISARM cluster below. */}
          <FullscreenToggle
            isFullscreen={isFullscreen}
            onToggle={toggleFullscreen}
            className="@hud:hidden absolute top-1.5 right-3 bg-white/10"
          />
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
