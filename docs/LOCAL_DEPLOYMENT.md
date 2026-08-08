# Local deployment

## Browser support (WebRTC over LAN)

The SITL stack advertises the address in `WEBRTC_ADDITIONAL_HOSTS` as its
WebRTC ICE candidate. mediamtx resolves regular hostnames **server-side**, but
`.local` mDNS names (e.g. `rados-mac-mini.local`) are placed in the SDP
**verbatim** and each browser must resolve them itself:

- **Chrome / Safari** delegate resolution to the OS (Bonjour) — works.
- **Firefox** resolves ICE candidates inside its own ICE stack, which cannot
  resolve arbitrary `.local` names — symptom: video never starts, `about:webrtc`
  shows an **empty ICE candidate-pair table**, and the player retries every
  ~2 s. VPNs and DNS-over-HTTPS can aggravate this.

To support Firefox over LAN, advertise the LAN IP literal first (the mDNS
hostname stays as a second candidate for everything else):

```sh
WEBRTC_ADDITIONAL_HOSTS="$(ipconfig getifaddr en0),$DEV_HOST" docker compose up -d
```

Production is unaffected: `webrtc.<domain>` is a regular DNS name, mediamtx
resolves it server-side, and every browser receives an IP-literal candidate.
