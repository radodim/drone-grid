import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useRef, useState } from "react"

import "@/lib/mediamtx-reader"
import { TelemetryHud } from "@/components/Drones/TelemetryHud"
import { useDroneState } from "@/hooks/useDroneState"
import { useTelemetrySocket } from "@/hooks/useTelemetrySocket"

export const Route = createFileRoute("/shares/$token")({
  component: SharedView,
  head: () => ({ meta: [{ title: "Shared Stream - Drone Grid" }] }),
})

interface ResolvedShare {
  drone_id: string
  drone_name: string
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
    return <Centered>This share link is no longer active.</Centered>
  }
  if (!resolved) {
    return <Centered>Loading…</Centered>
  }
  return (
    <Viewer
      token={token}
      droneId={resolved.drone_id}
      droneName={resolved.drone_name}
    />
  )
}

function Viewer({
  token,
  droneId,
  droneName,
}: {
  token: string
  droneId: string
  droneName: string
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<{ close: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)

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
      onTrack: (evt: RTCTrackEvent) => {
        if (videoRef.current) videoRef.current.srcObject = evt.streams[0]
      },
    })
    return () => {
      readerRef.current?.close()
      readerRef.current = null
    }
  }, [droneId, token])

  return (
    <div className="relative h-screen w-screen bg-black">
      <video
        ref={videoRef}
        muted
        autoPlay
        playsInline
        className="h-full w-full object-contain"
      />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}
      {/* No controlStatus → CTRL chip hidden; no DroneControls mounted. */}
      <TelemetryHud telemetry={telemetry} droneState={droneState} />
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-white text-xs font-mono">
        {droneName} · shared view (read-only)
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen items-center justify-center bg-background text-muted-foreground">
      {children}
    </div>
  )
}
