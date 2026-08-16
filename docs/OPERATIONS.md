# Operations

The map of how the hosted Drone Grid deployment is run. Companion/edge
device operations live in `services/companion/deploy/`; data-subject
request procedures live in [PRIVACY_OPS.md](PRIVACY_OPS.md).

## Deploys

Production deploys happen only via the GitHub release workflow
(`.github/workflows/deploy_production.yml`) on the droplet's self-hosted
runner: publishing a release checks out the tag, appends the `.env.prod`
files, and runs `docker compose -f compose.yaml build && up -d`.

Restart caution: `docker compose up -d <service>` recreates the whole
`depends_on` chain — touching `db` or `identity` this way kills every
Keycloak session. Prefer `docker compose restart <service>` for a plain
restart.

## Keycloak admin console (SSH tunnel only)

The admin console is not reachable from the internet: Traefik routes only
`/realms/drone-grid`, `/resources`, and `/.well-known` on
`auth.drone-grid.com`, and Keycloak's port binds to loopback on the
droplet.

```bash
ssh -N -L 8080:127.0.0.1:8080 root@<droplet>
```

Then open `http://127.0.0.1:8080/admin/`.

- The **local port must be 8080** — `KC_HOSTNAME_ADMIN=http://127.0.0.1:8080`
  pins every console URL to it; a different local port breaks the console.
- The local dev stack also binds 8080 — stop it before opening the tunnel.
- The **master realm's Frontend URL** is set to `http://127.0.0.1:8080`
  (Realm settings → General). This keeps the console's OIDC login inside
  the tunnel and is what makes blocking `/realms/master` publicly safe.
  Do not clear it.
- `kcadm.sh --server http://127.0.0.1:8080 ...` works over the same tunnel.

## Keycloak realm conventions

- Prod realm changes are click-ops via the tunnel.
  `config/keycloak/prod-realm.json` is a **mirror of prod** — documentation,
  never imported. After changing prod, re-export and update the mirror in
  the same PR. `local-realm.json` is imported on every dev boot
  (`--import-realm`) and drives the mailpit-backed local email flow.
- The SMTP password exists **only** in prod Keycloak (Realm settings →
  Email), entered via the tunnel — never in the JSON mirrors.
- **Registration go-live flip** (prod only, strictly after a release has
  shipped the legal pages and hardening): Realm settings → Login →
  User registration ON, Verify email ON, Forgot password ON. Mirror into
  `prod-realm.json` afterwards.
- Terms re-consent: bump the `termsAccepted` option value — procedure in
  [PRIVACY_OPS.md](PRIVACY_OPS.md).

## Email infrastructure

| Concern | Where |
|---|---|
| Transactional email (verification, reset) | Amazon SES, eu-central-1 — SMTP `email-smtp.eu-central-1.amazonaws.com:2587` (STARTTLS), From `noreply@drone-grid.com`, Reply-To `support@drone-grid.com` |
| Bounces / Return-Path | SES custom MAIL FROM `mail.drone-grid.com` |
| Human mail | Migadu — one real mailbox `admin@drone-grid.com`; aliases into it: `support@` (user help, ToS contact), `hello@` (landing page), `privacy@` (DSRs), `security@` (vulnerability reports), `dmarc@` (aggregate reports), plus `postmaster@`/`abuse@` |
| DMARC | `v=DMARC1; p=quarantine; rua=mailto:dmarc@drone-grid.com` — exactly **one** `_dmarc` record, ever (two = no policy) |
| DNS | DigitalOcean. The Hostname field takes the prefix only (DO appends the domain); TXT values are entered **without** quote characters |

Never enable on the SES identity: **engagement tracking** (rewrites
verification links through a tracking redirector and adds a pixel) and
**Auto Validation** (silently suppresses sends to "risky" addresses).
Both break authentication email.

SMTP credentials are a dedicated IAM user restricted to `ses:SendRawEmail`
with `ses:FromAddress = noreply@drone-grid.com`.

### Alarm response

CloudWatch (eu-central-1) → SNS → operator's personal address:
`Send` Sum > 50/hour and `Reputation.BounceRate` > 0.05.

If the send alarm fires: check Keycloak events (REGISTER volume) and the
rate limiter (`docker compose logs proxy | grep ' 429 '`); block abusive
sources at the firewall if needed; worst case, stop all sending by
clearing the SMTP host in Keycloak's Email settings.

Migadu tripwire: seven consecutive days over quota blocks the account and
**permanently blacklists the domain there** — upgrade the plan before
riding the limits, never after.

## Accounts

Every infrastructure account (DigitalOcean, AWS, Migadu, GitHub, DNS) is
rooted in the operator's personal address — never in an `@drone-grid.com`
mailbox. Recovery for the domain's infrastructure must live outside the
domain it recovers. Alarm destinations follow the same out-of-band rule.

## Abuse monitoring (weekly glance)

- Keycloak events (admin console → Realm settings → Events): REGISTER
  volume, error spikes.
- Rate limiter hits: `docker compose logs proxy | grep ' 429 '`.
- SES console: send counts, bounce/complaint rates.
- `dmarc@` mailbox: aggregate reports should show both senders (SES,
  Migadu) passing DKIM-aligned.
