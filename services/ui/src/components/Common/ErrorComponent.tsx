import { Link } from "@tanstack/react-router"

import { BootScreen } from "@/components/Common/BootScreen"
import { Button } from "@/components/ui/button"

const ErrorComponent = () => (
  <BootScreen message="Drone Grid encountered an unexpected error.">
    <Button asChild>
      <Link to="/">Go to drones</Link>
    </Button>
  </BootScreen>
)

export default ErrorComponent
