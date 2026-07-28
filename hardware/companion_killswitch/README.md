# Companion kill switch (ESP32 + SBUS)

Independent hardware channel to shut down the companion Pi from an RC
transmitter, bypassing the entire drone-grid stack. An ESP32 reads the RC
receiver's SBUS stream and pulses a GPIO low; the Pi's `gpio-shutdown` overlay
turns the pulse into a graceful shutdown.

Sketch: `companion_killswitch.ino` (Arduino IDE; Bolder Flight Systems SBUS
library). WiFi/BT are disabled at boot — the ESP32 does exactly one job.

## Wiring

- SBUS out (receiver) → ESP32 pin 16 (Serial2 RX, `inv=true` — SBUS is
  inverted UART, 100000 baud 8E2)
- ESP32 pin 23 → Pi shutdown GPIO (active-low pulse, 200 ms; idle HIGH)

## Trigger conditions (any one, first wins — one-shot until ESP32 reset)

1. **Failsafe flag** — the receiver lost the transmitter link and raises the
   SBUS failsafe bit (byte 23, bit 3) while continuing to emit frames. The
   sketch requires the flag to persist 200 ms (`FAILSAFE_DEBOUNCE_MS`).
   Total latency = receiver's own failsafe-declaration timeout
   (vendor-specific, typically 0.3–1.5 s) + 200 ms + ≤1 frame (~14 ms).
2. **Kill channel** — CH9 (`SHUTDOWN_CHANNEL`) above raw SBUS value 1000
   (mid-stick is ~992). `SWITCH_DEBOUNCE_MS 0` → fires on the first frame.
3. **SBUS silence** — no valid frame for 1 s (`LINK_LOSS_TIMEOUT_MS`) after at
   least one frame was seen since boot. Covers receiver death / severed wire,
   which the failsafe flag cannot (the flag only exists inside frames that
   arrive).

## Notes

- SBUS has **no checksum** (header/footer framing only) — channel values from
  a corrupted frame can parse as valid.
- The one-shot latch (`shutdownSignalSent`) means the ESP32 must be
  power-cycled to re-arm after any trigger.
- The silence trigger only arms after the first valid frame — a receiver dead
  from boot never triggers.
