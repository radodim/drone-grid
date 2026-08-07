import { Copy, EllipsisVertical } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type { DroneResponse } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import DeleteDrone from "./DeleteDrone"
import RotateSecret from "./RotateSecret"

interface DroneActionsMenuProps {
  drone: DroneResponse
}

export const DroneActionsMenu = ({ drone }: DroneActionsMenuProps) => {
  const [open, setOpen] = useState(false)

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVertical />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(drone.id)
            // The toast doubles as the ID's display surface — there is no
            // ID column to read it from.
            toast.success("Drone ID copied", {
              description: (
                <span className="font-mono text-xs">{drone.id}</span>
              ),
            })
          }}
        >
          <Copy />
          Copy ID
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <RotateSecret
          id={drone.id}
          name={drone.name}
          onSuccess={() => setOpen(false)}
        />
        <DropdownMenuSeparator />
        <DeleteDrone
          id={drone.id}
          name={drone.name}
          onSuccess={() => setOpen(false)}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
