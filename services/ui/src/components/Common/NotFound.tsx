import { Link } from "@tanstack/react-router"

import { BootScreen } from "@/components/Common/BootScreen"
import { Button } from "@/components/ui/button"

const NotFound = () => (
  <BootScreen message="The requested page does not exist.">
    <Button asChild>
      <Link to="/">Go to drones</Link>
    </Button>
  </BootScreen>
)

export default NotFound
