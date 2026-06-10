import keycloak from "@/keycloak"

const useAuth = () => {
  const user = keycloak.tokenParsed
    ? {
        email: keycloak.tokenParsed.email as string | undefined,
        full_name:
          [keycloak.tokenParsed.given_name, keycloak.tokenParsed.family_name]
            .filter(Boolean)
            .join(" ") || keycloak.tokenParsed.preferred_username,
        is_admin: (keycloak.tokenParsed.realm_access?.roles ?? []).includes(
          "admin",
        ),
      }
    : null

  const logout = () => {
    keycloak.logout()
  }

  return { user, logout }
}

export default useAuth
