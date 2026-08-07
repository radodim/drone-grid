import { Gamepad2, Hand, Keyboard } from "lucide-react"

import { cn } from "@/lib/utils"
import type { InputKind } from "@/types/input"

interface InputSourceSelectorProps {
  sources: Array<{ kind: InputKind; connected: boolean }>
  activeKind: InputKind
  onSelect: (kind: InputKind) => void
}

const ICON: Record<InputKind, typeof Gamepad2> = {
  gamepad: Gamepad2,
  keyboard: Keyboard,
  touch: Hand,
}

/** Picks the single active input source; disconnected sources are shown
 * but not selectable. */
export function InputSourceSelector({
  sources,
  activeKind,
  onSelect,
}: InputSourceSelectorProps) {
  return (
    <div className="pointer-events-auto bg-white/10 @hud:bg-black/60 rounded-full px-1 py-1 flex gap-1">
      {sources.map(({ kind, connected }) => {
        const Icon = ICON[kind]
        return (
          <button
            key={kind}
            type="button"
            disabled={!connected}
            title={connected ? `Control with ${kind}` : `${kind} not available`}
            aria-label={`Control with ${kind}`}
            onClick={() => onSelect(kind)}
            className={cn(
              "rounded-full p-1.5 text-white",
              kind === activeKind && "bg-white/25",
              !connected && "opacity-40",
            )}
          >
            <Icon className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
