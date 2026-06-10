interface AltimeterProps {
  relAltMeters: number | null
}

/**
 * Relative-altitude instrument. Plain readout for now — the designated
 * g3-gauge candidate: swap the internals, keep the props.
 */
export function Altimeter({ relAltMeters }: AltimeterProps) {
  return (
    <div className="bg-black/60 rounded px-3 py-2 text-right">
      <div className="text-2xl leading-none tabular-nums">
        {relAltMeters != null ? relAltMeters.toFixed(1) : "—"}
      </div>
      <div className="text-[10px] text-white/70 mt-1">ALT m (rel)</div>
    </div>
  )
}
