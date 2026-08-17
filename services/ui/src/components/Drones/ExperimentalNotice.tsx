import { TriangleAlert } from "lucide-react"

import { cn } from "@/lib/utils"

/** The release-wide liability note for live stream views. Slim by design —
 * always visible without stealing attention from the HUD. legalLinks is
 * for the accountless share view, where the privacy policy must be
 * reachable from the page (viewers never saw the registration flow). */
export function ExperimentalNotice({
  className,
  legalLinks = false,
}: {
  className?: string
  legalLinks?: boolean
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5",
        className,
      )}
    >
      <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
      <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-100/90">
        Experimental system — be careful and follow local laws and regulations
        {legalLinks && (
          <>
            {" · "}
            <a
              href="/terms.txt"
              className="underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-50"
            >
              Terms
            </a>
            {" · "}
            <a
              href="/privacy.txt"
              className="underline underline-offset-2 hover:text-amber-950 dark:hover:text-amber-50"
            >
              Privacy
            </a>
          </>
        )}
      </p>
    </div>
  )
}
