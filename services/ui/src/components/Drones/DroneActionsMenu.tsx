import { EllipsisVertical } from "lucide-react"
import { useState } from "react"

import type { DroneResponse } from "@/client"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
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
