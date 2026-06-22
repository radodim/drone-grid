import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft, Maximize, Minimize } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import "@/lib/mediamtx-reader"
import { DroneControls } from "@/components/Drones/DroneControls"
import { ShareDialog } from "@/components/Drones/ShareDialog"
import { TelemetryHud } from "@/components/Drones/TelemetryHud"
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

function DroneStream() {
  const { droneId } = Route.useParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
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
    const onFullscreenChange = () =>
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener("fullscreenchange", onFullscreenChange)
    return () =>
      document.removeEventListener("fullscreenchange", onFullscreenChange)
  }, [])

  // Fullscreen the container (not the <video>) so the HUD and controls
  // stay visible.
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    } else {
      containerRef.current?.requestFullscreen()
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Live Stream</h1>
          <p className="text-muted-foreground font-mono text-sm">{droneId}</p>
        </div>
        <ShareDialog droneId={droneId} />
      </div>
      <div
        ref={containerRef}
        className={cn(
          "rounded-lg overflow-hidden border bg-black relative",
          isFullscreen &&
            "flex items-center justify-center rounded-none border-0",
        )}
      >
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          className={cn("w-full aspect-video", isFullscreen && "max-h-full")}
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
        <DroneControls
          droneState={droneState}
          controlInput={controlInput}
          control={control}
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
    </div>
  )
}
