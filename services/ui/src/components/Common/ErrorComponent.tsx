import { Link } from "@tanstack/react-router"
import { Button } from "@/components/ui/button"

const ErrorComponent = () => {
  return (
    <div
      className="flex min-h-screen items-center justify-center flex-col p-4"
      data-testid="error-component"
    >
      <span className="text-6xl md:text-8xl font-bold leading-none mb-4">
        Error
      </span>
      <p className="text-lg text-muted-foreground mb-4 text-center">
        Drone Grid encountered an unexpected error.
      </p>
      <Link to="/">
        <Button>Go to drones</Button>
      </Link>
    </div>
  )
}

export default ErrorComponent
