import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

import { BootScreen } from "@/components/Common/BootScreen"
import { ExperimentalNotice } from "@/components/Drones/ExperimentalNotice"
import { FullscreenToggle } from "@/components/Drones/FullscreenToggle"
import { TelemetryHud, TelemetryStrip } from "@/components/Drones/TelemetryHud"
import { useDroneState } from "@/hooks/useDroneState"
import { useFullscreenLandscapeLock } from "@/hooks/useFullscreenLandscapeLock"
import { useTelemetrySocket } from "@/hooks/useTelemetrySocket"
import "@/lib/mediamtx-reader"
import { cn } from "@/lib/utils"

export const Route = createFileRoute("/shares/$token")({
  component: SharedView,
  head: () => ({ meta: [{ title: "Shared Stream - Drone Grid" }] }),
})

interface ResolvedShare {
  drone_id: string
}

/**
 * Public, read-only viewer for a share link. Renders outside the app shell
 * (no sidebar, no auth) — it opens ONLY the telemetry socket and the video
 * reader with the `dgs_` share token, never a control socket, so it's
 * structurally incapable of commanding the drone.
 */
function SharedView() {
  const { token } = Route.useParams()
  const [resolved, setResolved] = useState<ResolvedShare | null>(null)
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    let active = true
    fetch(`${import.meta.env.VITE_API_URL}/api/v1/shares/${token}`)
      .then((res) => {
        if (!res.ok) throw new Error("invalid share")
        return res.json() as Promise<ResolvedShare>
      })
      .then((data) => active && setResolved(data))
      .catch(() => active && setInvalid(true))
    return () => {
      active = false
    }
  }, [token])

  if (invalid) {
    return <BootScreen message="This share link is no longer active." />
  }
  if (!resolved) {
    return <BootScreen message="connecting…" pulse />
  }
  return <Viewer token={token} droneId={resolved.drone_id} />
}

function Viewer({ token, droneId }: { token: string; droneId: string }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const readerRef = useRef<{ close: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // False until the element reports rendering frames ('playing') — drives
  // the "awaiting video" placeholder over the otherwise-black box. Reset on
  // reader errors so recovery gaps are narrated too.
  const [videoLive, setVideoLive] = useState(false)
  useEffect(() => {
    if (error) setVideoLive(false)
  }, [error])
  // Fullscreen the whole view (notice included), same as the owner player.
  const { isFullscreen, toggleFullscreen } =
    useFullscreenLandscapeLock(containerRef)

  const { telemetry, status, lastMessageAt } = useTelemetrySocket(
    droneId,
    token,
  )
  const droneState = useDroneState({
    telemetry,
    lastMessageAt,
    socketStatus: status,
    videoError: error,
  })

  useEffect(() => {
    const whepUrl = `${import.meta.env.VITE_WEBRTC_URL}/${droneId}/whep`
    readerRef.current = new (window as any).MediaMTXWebRTCReader({
      url: whepUrl,
      token,
      onError: (err: string) => setError(err),
      // onTrack re-fires on every reconnect (fresh peer connection per
      // retry) — clear the stale error overlay on recovery.
      onTrack: (evt: RTCTrackEvent) => {
        setError(null)
        if (videoRef.current) videoRef.current.srcObject = evt.streams[0]
      },
    })
    return () => {
      readerRef.current?.close()
      readerRef.current = null
    }
  }, [droneId, token])

  return (
    <div
      ref={containerRef}
      className={cn(
        "@container flex h-screen w-screen flex-col bg-black",
        // Fullscreen owns the physical screen edges — keep the bottom strip
        // clear of gesture bars (env() needs viewport-fit=cover).
        isFullscreen && "pb-[env(safe-area-inset-bottom)]",
      )}
    >
      {/* In-flow above the picture area, like the owner view — the HUD's
          top chips keep their corner. Safe-area padding clears notches
          (viewport-fit=cover). */}
      <ExperimentalNotice className="pt-[calc(env(safe-area-inset-top)+0.375rem)]" />
      <div className="relative min-h-0 flex-1">
        <video
          ref={videoRef}
          muted
          autoPlay
          playsInline
          onPlaying={() => setVideoLive(true)}
          className="h-full w-full object-contain"
        />
        {!videoLive && !error && (
          <div className="absolute inset-0 flex items-center justify-center">
            <p className="font-mono text-xs text-white/50 motion-safe:animate-pulse">
              Awaiting video signal…
            </p>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-destructive text-sm">
              Video stream error — {error}
            </p>
          </div>
        )}
        {/* No controlStatus → CTRL chip hidden; no DroneControls mounted. */}
        <TelemetryHud telemetry={telemetry} droneState={droneState} />
        {/* This video fills the picture area — no below-the-picture flow —
            so the narrow diagnostics strip pins to the bottom letterbox. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-4">
          <TelemetryStrip telemetry={telemetry} droneState={droneState} />
        </div>
        <FullscreenToggle
          isFullscreen={isFullscreen}
          onToggle={toggleFullscreen}
          className="absolute bottom-4 right-4 bg-black/60"
        />
      </div>
    </div>
  )
}
