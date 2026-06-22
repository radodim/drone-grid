import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Copy, Link2, Trash2 } from "lucide-react"
import { useState } from "react"

import { DronesService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"

const TTL_OPTIONS = [
  { value: "2", label: "2 hours" },
  { value: "6", label: "6 hours" },
  { value: "12", label: "12 hours" },
  { value: "24", label: "24 hours" },
]

/** Owner-facing share-link management: create a read-only link (shown once),
 * see active links, revoke them. View access is enforced backend-side. */
export function ShareDialog({ droneId }: { droneId: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [label, setLabel] = useState("")
  const [ttlHours, setTtlHours] = useState("2")
  const [createdUrl, setCreatedUrl] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()

  const sharesQuery = useQuery({
    queryKey: ["shares", droneId],
    queryFn: () => DronesService.listShares({ droneId }),
    enabled: isOpen,
  })

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["shares", droneId] })

  const createMutation = useMutation({
    mutationFn: () =>
      DronesService.createShare({
        droneId,
        requestBody: {
          label: label.trim() || null,
          ttl_hours: Number(ttlHours),
        },
      }),
    onSuccess: (share) => {
      setCreatedUrl(`${window.location.origin}/shares/${share.token}`)
      setLabel("")
    },
    onError: handleError.bind(showErrorToast),
    onSettled: invalidate,
  })

  const revokeMutation = useMutation({
    mutationFn: (shareId: string) =>
      DronesService.revokeShare({ droneId, shareId }),
    onError: handleError.bind(showErrorToast),
    onSettled: invalidate,
  })

  const copy = (url: string) => {
    navigator.clipboard.writeText(url)
    showSuccessToast("Link copied")
  }

  const activeShares = sharesQuery.data ?? []

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        setIsOpen(open)
        if (!open) setCreatedUrl(null)
      }}
    >
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Link2 className="mr-2 size-4" />
          Share
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share live view</DialogTitle>
          <DialogDescription>
            Anyone with the link can watch this drone's video and telemetry —
            read-only, no control. Links expire and can be revoked.
          </DialogDescription>
        </DialogHeader>

        {createdUrl && (
          <div className="rounded-md border p-3 space-y-2">
            <p className="text-sm text-muted-foreground">
              Copy this link now — it won't be shown again.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={createdUrl}
                className="font-mono text-xs"
              />
              <Button
                size="icon"
                variant="outline"
                onClick={() => copy(createdUrl)}
              >
                <Copy className="size-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <span className="text-sm">Label (optional)</span>
            <Input
              placeholder="e.g. for the client"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <span className="text-sm">Expires</span>
            <Select value={ttlHours} onValueChange={setTtlHours}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TTL_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <LoadingButton
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            Create link
          </LoadingButton>
        </div>

        {activeShares.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Active links</p>
            {activeShares.map((share) => (
              <div
                key={share.id}
                className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
              >
                <div>
                  <div>{share.label || "Untitled link"}</div>
                  <div className="text-xs text-muted-foreground">
                    Expires {formatExpiry(share.expiration_timestamp)}
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  disabled={revokeMutation.isPending}
                  onClick={() => revokeMutation.mutate(share.id)}
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Backend serializes naive UTC; treat a tz-less string as UTC. */
function formatExpiry(iso: string): string {
  const hasTz = /[Z+]|-\d{2}:\d{2}$/.test(iso)
  const date = new Date(hasTz ? iso : `${iso}Z`)
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}
