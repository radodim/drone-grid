import { Link } from "@tanstack/react-router"
import { useId } from "react"

import { cn } from "@/lib/utils"

interface LogoProps {
  variant?: "full" | "icon" | "responsive"
  className?: string
  asLink?: boolean
}

/** The cloud-quad mark, inlined from public/favicon.svg (kept in sync by
 * hand — it changes at brand pace, not code pace). Inline so it paints with
 * the first render, no asset fetch. useId keeps every instance's defs
 * self-contained: duplicate ids would make a visible copy reference the
 * gradient of a display:none twin (sidebar collapse), which Chromium
 * refuses to paint — rotors render, cloud vanishes. */
function LogoMark({ className }: { className?: string }) {
  const uid = useId()
  const sky = `${uid}-sky`
  const rotor = `${uid}-rotor`
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8CC6F4" />
          <stop offset="1" stopColor="#2E6CB8" />
        </linearGradient>
        <g id={rotor}>
          <circle r="13" fill="#DCEEFB" stroke="#8CC6F4" strokeWidth="2" />
          <circle r="4.5" fill="#2B62A6" />
          <path
            d="M-14.6 -12.2 A19 19 0 0 0 -8 17.2 M14.6 12.2 A19 19 0 0 0 8 -17.2"
            fill="none"
            stroke="#4C9FE8"
            strokeWidth="4"
            strokeLinecap="round"
          />
        </g>
      </defs>
      <path
        d="M84 98 42 44 M116 98 158 44 M84 118 42 166 M116 118 158 166"
        fill="none"
        stroke="#2B62A6"
        strokeWidth="10"
        strokeLinecap="round"
      />
      <path
        d="M60 128 A20 20 0 0 1 63 90 A22 22 0 0 1 100 74 A24 24 0 0 1 140 88 A21 21 0 0 1 146 128 Z"
        fill={`url(#${sky})`}
      />
      <use href={`#${rotor}`} x="42" y="44" />
      <use href={`#${rotor}`} x="158" y="44" />
      <use href={`#${rotor}`} x="42" y="166" />
      <use href={`#${rotor}`} x="158" y="166" />
    </svg>
  )
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
          <LogoMark className="size-10" />
          <span className="font-semibold text-lg">Drone Grid</span>
        </div>
        <LogoMark
          className={cn(
            "size-10 hidden group-data-[collapsible=icon]:block",
            className,
          )}
        />
      </>
    ) : variant === "full" ? (
      <div className={cn("flex items-center gap-2", className)}>
        <LogoMark className="size-10" />
        <span className="font-semibold text-lg">Drone Grid</span>
      </div>
    ) : (
      <LogoMark className={cn("size-10", className)} />
    )

  if (!asLink) {
    return content
  }

  return <Link to="/">{content}</Link>
}
