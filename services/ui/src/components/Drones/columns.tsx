import { Link } from "@tanstack/react-router"
import type { ColumnDef } from "@tanstack/react-table"
import { Circle } from "lucide-react"

import type { DroneResponse } from "@/client"
import { DroneActionsMenu } from "./DroneActionsMenu"

export const columns: ColumnDef<DroneResponse>[] = [
  {
    accessorKey: "name",
    header: "Name",
    // Deliberately not a link: an offline drone's stream page is a wall of
    // reconnect noise. Live (below) is the only stream door; share links
    // are managed on the Shares page instead.
    // block + max-w: cells are whitespace-nowrap, so an untruncated long
    // name would force the whole table into horizontal scroll.
    cell: ({ row }) => (
      <span className="block max-w-[40ch] truncate font-medium">
        {row.original.name}
      </span>
    ),
  },
  {
    // Desktop-only: the UUID is what lands in companion.env, so seeing it
    // beside the name has provisioning value where width allows. "Copy ID"
    // in the actions menu stays the one-click path (and the only one on
    // phones, where this column is hidden).
    accessorKey: "id",
    header: "ID",
    meta: { className: "hidden lg:table-cell" },
    cell: ({ row }) => (
      <span className="font-mono text-xs text-muted-foreground">
        {row.original.id}
      </span>
    ),
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
