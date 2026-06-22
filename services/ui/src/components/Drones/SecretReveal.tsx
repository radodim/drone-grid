import { Copy } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import useCustomToast from "@/hooks/useCustomToast"

/** One-time secret display. The backend returns a drone's plaintext secret only
 * once (on create or rotate), so this is the single chance to copy it. */
export function SecretReveal({ secret }: { secret: string }) {
  const { showSuccessToast } = useCustomToast()

  const copy = () => {
    navigator.clipboard.writeText(secret)
    showSuccessToast("Secret copied")
  }

  return (
    <div className="rounded-md border p-3 space-y-2">
      <p className="text-sm text-muted-foreground">
        Copy this secret now — it won't be shown again. Put it in the
        companion's{" "}
        <code className="font-mono text-foreground">DRONE_SECRET</code>.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={secret} className="font-mono text-xs" />
        <Button size="icon" variant="outline" onClick={copy}>
          <Copy className="size-4" />
        </Button>
      </div>
    </div>
  )
}
