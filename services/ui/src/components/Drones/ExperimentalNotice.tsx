import { Link } from "@tanstack/react-router"
import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** The release-wide liability note for live stream views. Slim by design —
 * always visible without stealing attention from the HUD. The tail phrase
 * links to the Terms of Service.
 * TODO(docs): link the safety docs (recommended setup: kill switch, VLOS
 * practices) once they exist. */
export function ExperimentalNotice({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5",
        className,
      )}
    >
      <TriangleAlert className="size-3.5 shrink-0 text-amber-400" />
      <p className="text-[11px] leading-snug text-amber-100/90">
        Experimental system — be careful and{" "}
        <Link
          to="/terms"
          className="underline underline-offset-2 hover:text-amber-50"
        >
          follow local laws and regulations
        </Link>
        .
      </p>
    </div>
  )
}
