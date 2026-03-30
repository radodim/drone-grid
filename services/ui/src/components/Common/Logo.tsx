import { Link } from "@tanstack/react-router"
import { Plane } from "lucide-react"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

export function Logo({
  variant = "full",
  className,
  asLink = true,
}: LogoProps) {
  const content =
    variant === "responsive" ? (
      <>
        <div
          className={cn(
            "flex items-center gap-2 group-data-[collapsible=icon]:hidden",
            className,
          )}
        >
          <Plane className="size-5 text-primary" />
          <span className="font-semibold text-lg">Drone Grid</span>
        </div>
        <Plane
          className={cn(
            "size-5 text-primary hidden group-data-[collapsible=icon]:block",
            className,
          )}
        />
      </>
    ) : variant === "full" ? (
      <div className={cn("flex items-center gap-2", className)}>
        <Plane className="size-5 text-primary" />
        <span className="font-semibold text-lg">Drone Grid</span>
      </div>
    ) : (
      <Plane className={cn("size-5 text-primary", className)} />
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
