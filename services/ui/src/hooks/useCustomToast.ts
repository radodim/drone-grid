import { toast } from "sonner"

/** The message IS the title — toasts name the action ("Credentials copied",
 * "Drone name already exists"), never a generic "Success!". */
const useCustomToast = () => {
  const showSuccessToast = (message: string) => {
    toast.success(message)
  }

  const showErrorToast = (message: string) => {
    toast.error(message)
  }

  return { showSuccessToast, showErrorToast }
}

export default useCustomToast
