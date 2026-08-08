import { Button } from "@/components/ui/button"
import { Link } from "@tanstack/react-router"

const NotFound = () => {
  return (
    <div
      className="flex min-h-screen items-center justify-center flex-col p-4"
      data-testid="not-found"
    >
      <span className="text-6xl md:text-8xl font-bold leading-none mb-4">
        404
      </span>
      <p className="text-lg text-muted-foreground mb-4 text-center">
        The requested page does not exist.
      </p>
      <Link to="/">
        <Button className="mt-4">Go to drones</Button>
      </Link>
    </div>
  )
}

export default NotFound
