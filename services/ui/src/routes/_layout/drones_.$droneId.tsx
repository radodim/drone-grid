import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import "@/lib/mediamtx-reader"
import { Button } from "@/components/ui/button"
import keycloak from "@/keycloak"

export const Route = createFileRoute("/_layout/drones_/$droneId")({
  component: DroneStream,
  head: () => ({
    meta: [{ title: "Live Stream - Drone Grid" }],
  }),
})

function DroneStream() {
  const { droneId } = Route.useParams()
  const videoRef = useRef<HTMLVideoElement>(null)
  const readerRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)

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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Live Stream</h1>
          <p className="text-muted-foreground font-mono text-sm">{droneId}</p>
        </div>
      </div>
      <div className="rounded-lg overflow-hidden border bg-black relative">
        <video
          ref={videoRef}
          controls
          muted
          autoPlay
          playsInline
          className="w-full aspect-video"
        />
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80">
            <p className="text-destructive text-sm">{error}</p>
          </div>
        )}
      </div>
    </div>
  )
}
