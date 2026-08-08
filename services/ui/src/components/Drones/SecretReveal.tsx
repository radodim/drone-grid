import { Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import useCustomToast from "@/hooks/useCustomToast"

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
  const { showSuccessToast } = useCustomToast()
  const envBlock = `DRONE_ID=${droneId}\nDRONE_SECRET=${secret}`

  const copy = () => {
    navigator.clipboard.writeText(envBlock)
    showSuccessToast("Credentials copied")
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <p className="text-sm text-muted-foreground">
        Paste into the companion's{" "}
        <code className="font-mono text-foreground">companion.env</code> — the
        secret won't be shown again.
      </p>
      <div className="flex items-start gap-2">
        <pre className="flex-1 overflow-x-auto rounded bg-muted px-3 py-2 font-mono text-xs leading-relaxed">
          {envBlock}
        </pre>
        <Button size="icon" variant="outline" onClick={copy}>
          <Copy className="size-4" />
          <span className="sr-only">Copy credentials</span>
        </Button>
      </div>
    </div>
  )
}
