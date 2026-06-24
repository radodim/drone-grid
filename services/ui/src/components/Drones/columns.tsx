import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { Check, Circle, Copy } from "lucide-react"

import type { DroneResponse } from "@/client"
import { Button } from "@/components/ui/button"
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard"
import { DroneActionsMenu } from "./DroneActionsMenu"

function CopyId({ id }: { id: string }) {
  const [copiedText, copy] = useCopyToClipboard()
  const isCopied = copiedText === id

  return (
    <div className="flex items-center gap-1.5 group whitespace-nowrap">
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

export const columns: ColumnDef<DroneResponse>[] = [
  {
    accessorKey: "id",
    header: "ID",
    cell: ({ row }) => <CopyId id={row.original.id} />,
  },
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => <span className="font-medium">{row.original.name}</span>,
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
    accessorKey: "creation_timestamp",
    header: "Created",
    cell: ({ row }) => (
      <span className="text-muted-foreground text-sm">
        {new Date(row.original.creation_timestamp).toLocaleDateString()}
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
