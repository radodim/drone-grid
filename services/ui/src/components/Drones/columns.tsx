import type { ColumnDef } from "@tanstack/react-table"
import { Link } from "@tanstack/react-router"
import { Check, Circle, Copy, Eye, EyeOff } from "lucide-react"
import { useState } from "react"

import type { DroneResponse } from "@/client"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { DroneActionsMenu } from "./DroneActionsMenu"

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === id

  return (
    <div className="flex items-center gap-1.5 group">
      <span className="font-mono text-xs text-muted-foreground">{id}</span>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copy(id)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">Copy ID</span>
      </Button>
    </div>
  )
}

function SecretKey({ secretKey }: { secretKey: string }) {
  const [revealed, setRevealed] = useState(false)
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === secretKey

  return (
    <div className="flex items-center gap-1.5 group">
      <code
        className={`text-xs bg-muted px-2 py-1 rounded font-mono ${
          revealed ? "" : "select-none"
        }`}
        style={revealed ? {} : { filter: "blur(5px)" }}
      >
        {secretKey}
      </code>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => setRevealed(!revealed)}
      >
        {revealed ? (
          <EyeOff className="size-3" />
        ) : (
          <Eye className="size-3" />
        )}
        <span className="sr-only">{revealed ? "Hide" : "Reveal"}</span>
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="size-6 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={() => copy(secretKey)}
      >
        {isCopied ? (
          <Check className="size-3 text-green-500" />
        ) : (
          <Copy className="size-3" />
        )}
        <span className="sr-only">Copy secret</span>
      </Button>
    </div>
  )
}

export const columns: ColumnDef<DroneResponse>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <span className="font-medium">{row.original.name}</span>
    ),
  },
  {
    accessorKey: "secret_key",
    header: "Secret Key",
    cell: ({ row }) => <SecretKey secretKey={row.original.secret_key} />,
  },
  {
    accessorKey: "stream_url",
    header: "Status",
    cell: ({ row }) => {
      const streamUrl = row.original.stream_url
      if (streamUrl) {
        return (
          <Link
            to="/drones/$droneId"
            params={{ droneId: row.original.id }}
            className="flex items-center gap-2 hover:underline"
          >
            <Circle className="size-2.5 fill-green-500 text-green-500" />
            <span className="text-green-500 text-sm font-medium">Live</span>
          </Link>
        )
      }
      return (
        <div className="flex items-center gap-2">
          <Circle className="size-2.5 fill-muted-foreground text-muted-foreground" />
          <span className="text-muted-foreground text-sm">Offline</span>
        </div>
      )
    },
  },
  {
    accessorKey: "created_at",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(row.original.created_at).toLocaleDateString()}
      </span>
    ),
  },
  {
    id: "actions",
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <DroneActionsMenu drone={row.original} />
      </div>
    ),
  },
]
