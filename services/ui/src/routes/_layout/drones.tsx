import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute } from "@tanstack/react-router"
import { Search } from "lucide-react"
import { Suspense } from "react"

import { DronesService } from "@/client"
import { DataTable } from "@/components/Common/DataTable"
import AddDrone from "@/components/Drones/AddDrone"
import { columns } from "@/components/Drones/columns"
import { Skeleton } from "@/components/ui/skeleton"

// TODO: Add a manual refresh button
// TODO: Explore websocket streaming of changes instead of polling
function getDronesQueryOptions() {
  return {
    queryFn: () => DronesService.listDrones(),
    queryKey: ["drones"],
    refetchInterval: 5000,
  }
}

export const Route = createFileRoute("/_layout/drones")({
  component: Drones,
  head: () => ({
    meta: [
      {
        title: "Drones - Drone Grid",
      },
    ],
  }),
})

function PendingDrones() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}

function DronesTableContent() {
  const { data: drones } = useSuspenseQuery(getDronesQueryOptions())

  if (drones.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center py-12">
        <div className="rounded-full bg-muted p-4 mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold">
          You don't have any drones yet
        </h3>
        <p className="text-muted-foreground">
          Register a new drone to get started
        </p>
      </div>
    )
  }

  return <DataTable columns={columns} data={drones} />
}

function DronesTable() {
  return (
    <Suspense fallback={<PendingDrones />}>
      <DronesTableContent />
    </Suspense>
  )
}

function Drones() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Drones</h1>
          <p className="text-muted-foreground">
            Register and manage your drones
          </p>
        </div>
        <AddDrone />
      </div>
      <DronesTable />
    </div>
  )
}
