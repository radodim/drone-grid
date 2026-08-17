import { AxiosError } from "axios"
import type { ApiError } from "./client"

function extractErrorMessage(err: ApiError): string {
  // The server's detail beats axios's generic "Request failed…" message.
  const errDetail =
    err instanceof AxiosError
      ? (err.response?.data as any)?.detail
      : (err.body as any)?.detail
  if (Array.isArray(errDetail) && errDetail.length > 0) {
    return errDetail[0].msg
  }
  if (typeof errDetail === "string") {
    return errDetail
  }
  return err instanceof AxiosError ? err.message : "Something went wrong."
}

export const handleError = function (
  this: (msg: string) => void,
  err: ApiError,
) {
  const errorMessage = extractErrorMessage(err)
  this(errorMessage)
}

export const getInitials = (name: string): string => {
  return name
    .split(" ")
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
}
