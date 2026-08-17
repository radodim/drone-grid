import { zodResolver } from "@hookform/resolvers/zod"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { z } from "zod"

import { type DroneCreate, DronesService } from "@/client"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { handleError } from "@/utils"
import { SecretReveal } from "./SecretReveal"

const formSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
})

type FormData = z.infer<typeof formSchema>

const AddDrone = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [created, setCreated] = useState<{
    id: string
    secret: string
  } | null>(null)
  const queryClient = useQueryClient()
  const { showErrorToast } = useCustomToast()

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onBlur",
    criteriaMode: "all",
    defaultValues: {
      name: "",
    },
  })

  const mutation = useMutation({
    mutationFn: (data: DroneCreate) =>
      DronesService.createDrone({ requestBody: data }),
    onSuccess: (drone) => {
      setCreated({ id: drone.id, secret: drone.secret })
      form.reset()
    },
    onError: handleError.bind(showErrorToast),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["drones"] })
    },
  })

  const close = () => {
    setIsOpen(false)
    setCreated(null)
    form.reset()
  }

  const onSubmit = (data: FormData) => {
    mutation.mutate(data)
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => (open ? setIsOpen(true) : close())}
    >
      <DialogTrigger asChild>
        <Button className="my-4">
          <Plus className="mr-2" />
          Add Drone
        </Button>
      </DialogTrigger>
      {/* Same soft-keyboard handling as ShareDialog: top-anchored below sm
          so the keyboard can't hide the dialog, and no focus on open — the
          keyboard appears only when the name field is tapped. */}
      <DialogContent
        className="top-8 translate-y-0 max-h-[calc(100dvh-4rem)] overflow-y-auto sm:top-[50%] sm:translate-y-[-50%] sm:max-w-lg"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Add Drone</DialogTitle>
          <DialogDescription>
            {created
              ? "Your drone is registered. Save its credentials below."
              : "Register a new drone. Its credentials will be generated and shown once."}
          </DialogDescription>
        </DialogHeader>

        {created ? (
          <div className="space-y-4">
            <SecretReveal droneId={created.id} secret={created.secret} />
            <DialogFooter>
              <Button onClick={close}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 py-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        Name <span className="text-destructive">*</span>
                      </FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g. Recon Alpha"
                          type="text"
                          {...field}
                          required
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline" disabled={mutation.isPending}>
                    Cancel
                  </Button>
                </DialogClose>
                <LoadingButton type="submit" loading={mutation.isPending}>
                  Create
                </LoadingButton>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default AddDrone
