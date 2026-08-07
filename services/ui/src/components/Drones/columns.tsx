import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { Circle } from "lucide-react"

import type { DroneResponse } from "@/client"
import { DroneActionsMenu } from "./DroneActionsMenu"

// No ID column: the UUID is a copy-source, not a browsing datum — "Copy ID"
// lives in the actions menu, and the full value renders on the stream page.
export const columns: ColumnDef<DroneResponse>[] = [
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
