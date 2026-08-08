import type { ReactNode } from "react"

import { Logo } from "@/components/Common/Logo"
import { cn } from "@/lib/utils"

/** Full-viewport branded holding screen — the product's first paint (auth
 * boot, Keycloak-redirect hold), pre-app gates (share-link resolution), and
 * terminal pages (404, error). A hero lockup: this and the login page are
 * where the brand gets to be loud; the app shell's corner logo stays quiet. */
export function BootScreen({
  message,
  pulse = false,
  children,
}: {
  message: string
  pulse?: boolean
  children?: ReactNode
}) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-background p-4">
      <Logo variant="icon" asLink={false} className="size-24" />
      <span className="mt-4 font-semibold text-2xl tracking-tight">
        Drone Grid
      </span>
      <p
        className={cn(
          "mt-2 text-center font-mono text-muted-foreground text-xs",
          pulse && "motion-safe:animate-pulse",
        )}
      >
        {message}
      </p>
      {children && <div className="mt-6">{children}</div>}
    </div>
  )
}
