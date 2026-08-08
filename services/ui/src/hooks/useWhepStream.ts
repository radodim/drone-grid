import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"

import "@/lib/mediamtx-reader"
import keycloak from "@/keycloak"

/** The vendored reader registers itself on window (plain-JS script). */
interface MediaMtxReader {
  close: () => void
}
interface MediaMtxReaderConstructor {
  new (conf: {
    url: string
    token: string
    onError: (err: string) => void
    onTrack: (evt: RTCTrackEvent) => void
  }): MediaMtxReader
}

/**
 * WHEP playback for a drone's stream: opens the vendored mediamtx reader,
 * attaches the incoming track to the video element, and surfaces reader
 * errors as a toast plus returned state (which feeds droneState.videoError).
 */
export function useWhepStream(
  droneId: string,
  videoRef: React.RefObject<HTMLVideoElement | null>,
): { error: string | null } {
  const [error, setError] = useState<string | null>(null)
  const readerRef = useRef<MediaMtxReader | null>(null)

  useEffect(() => {
    const Reader = (
      window as Window & { MediaMTXWebRTCReader?: MediaMtxReaderConstructor }
    ).MediaMTXWebRTCReader
    if (Reader === undefined) {
      setError("video reader failed to load")
      return
    }

    readerRef.current = new Reader({
      url: `${import.meta.env.VITE_WEBRTC_URL}/${droneId}/whep`,
      token: keycloak.token || "",
      onError: (err) => {
        console.error("WebRTC reader error:", err)
        setError(err)
        // Stable id: the reader retries every ~2s while down, and each
        // attempt re-fires onError — update one toast instead of stacking.
        toast.error("Video stream error", {
          id: "stream-error",
          description: err,
        })
      },
      // Every retry builds a fresh peer connection, so onTrack re-fires on
      // each successful reconnect — it doubles as the recovery signal.
      onTrack: (evt) => {
        setError(null)
        toast.dismiss("stream-error")
        if (videoRef.current) {
          videoRef.current.srcObject = evt.streams[0]
        }
      },
    })

    return () => {
      readerRef.current?.close()
      readerRef.current = null
    }
  }, [droneId, videoRef])

  return { error }
}
