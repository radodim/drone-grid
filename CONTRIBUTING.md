# Contributing

Thanks for your interest in Drone Grid! This is a one man show (for now) and that is why contributions are welcome.

## Before you start

- For features, please **open an issue first** so we can discuss the scope and approach.
- Security vulnerabilities: see [SECURITY.md](SECURITY.md).

## Development setup

The root [README](README.md) quick start brings up the full Drone Grid system on your local machine.
Each service has its own README with per-service tooling:
[backend](services/backend/README.md) · [ui](services/ui/README.md) ·
[companion](services/companion/README.md)

## Code style

- **Python** — formatted and linted with [Ruff](https://docs.astral.sh/ruff/)
  defaults. Comments are added where variable, class and function names fall short.
- **TypeScript/React** — `bun run lint` (biome) in `services/ui`; unit tests with `bun test src`.
- **Bash** — shellcheck-clean - please follow the style of the existing shell scripts.

## Pull requests

- Target `main`; keep each PR focused on one change.
- All changes are added through PRs that are reviewed and approved by the maintainer.
- GitHub Actions runs on fork PRs only after maintainer approval (repository policy). Deployment workflows are release-triggered on maintainer
  infrastructure and never run for pull requests.
- By submitting a contribution you agree it is licensed under the project's [MIT License](LICENSE).
