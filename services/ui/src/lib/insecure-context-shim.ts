// keycloak-js insists on crypto.randomUUID (secure-context-only) for its
// login state/nonce — opaque strings nobody format-checks. On LAN dev over
// plain http, back-fill it with random hex. Inert on https/localhost.
if (!window.isSecureContext && crypto.randomUUID === undefined) {
  crypto.randomUUID = (() =>
    Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
      b.toString(16).padStart(2, "0"),
    ).join("")) as Crypto["randomUUID"]
}

export { }
