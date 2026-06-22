import { useMutation, useQueryClient } from "@tanstack/react-query"
import { KeyRound } from "lucide-react"
import { useState } from "react"

import { DronesService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SecretReveal } from "./SecretReveal"

interface RotateSecretProps {
  id: string
  name: string
  onSuccess: () => void
}

const RotateSecret = ({ id, name, onSuccess }: RotateSecretProps) => {
  const [isOpen, setIsOpen] = useState(false)
  const [newSecret, setNewSecret] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const mutation = useMutation({
    mutationFn: (droneId: string) => DronesService.rotateSecret({ droneId }),
    onSuccess: (result) => {
      setNewSecret(result.secret)
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["drones"] })
    },
  })

  const close = () => {
    setIsOpen(false)
    setNewSecret(null)
    onSuccess()
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (open ? setIsOpen(true) : close())}
    >
      <DropdownMenuItem
        onSelect={(e) => e.preventDefault()}
        onClick={() => setIsOpen(true)}
      >
        <KeyRound />
        Rotate Secret
      </DropdownMenuItem>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Rotate secret</DialogTitle>
          <DialogDescription>
            {newSecret
              ? "Update the companion's DRONE_SECRET with the new value below."
              : `This invalidates ${name}'s current secret. Its companion will disconnect until you update its DRONE_SECRET. Continue?`}
          </DialogDescription>
        </DialogHeader>

        {newSecret ? (
          <div className="space-y-4">
            <SecretReveal secret={newSecret} />
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter className="mt-4">
            <DialogClose asChild>
              <Button variant="outline" disabled={mutation.isPending}>
                Cancel
              </Button>
            </DialogClose>
            <LoadingButton
              loading={mutation.isPending}
              onClick={() => mutation.mutate(id)}
            >
              Rotate
            </LoadingButton>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default RotateSecret
