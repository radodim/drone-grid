import { Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"
import { copyText } from "@/lib/clipboard"

/** One-time credentials display. The backend returns a drone's plaintext
 * secret only once (on create or rotate), so this is the single chance to
 * copy it — presented as the exact block the companion's env file needs. */
export function SecretReveal({
  droneId,
  secret,
}: {
  droneId: string
  secret: string
}) {
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const envBlock = `DRONE_ID=${droneId}\nDRONE_SECRET=${secret}`

  const copy = async () => {
    if (await copyText(envBlock)) {
      showSuccessToast("Credentials copied")
    } else {
      showErrorToast("Copy failed — copy the block manually")
    }
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Paste into the companion's{" "}
          <code className="font-mono text-foreground">companion.env</code> — the
          secret won't be shown again.
        </p>
        <Button
          size="icon"
          variant="outline"
          className="shrink-0"
          onClick={copy}
        >
          <Copy className="size-4" />
          <span className="sr-only">Copy credentials</span>
        </Button>
      </div>
      {/* Full-width block so the env lines fit unwrapped; break-all stays as
          the fallback so an overlong value wraps instead of inflating the
          dialog — the secret must be fully visible for eyeball verification. */}
      <pre className="whitespace-pre-wrap break-all rounded bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
        {envBlock}
      </pre>
      <p className="text-muted-foreground text-sm">
        First time? Follow the{" "}
        <a
          href="https://docs.drone-grid.com/hardware/x650-raspberry-pi/companion-setup/"
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2 hover:text-foreground"
        >
          companion setup guide
        </a>
        .
      </p>
    </div>
  )
}
