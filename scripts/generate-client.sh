#!/bin/bash

set -e
set -x

# Run this script from the project root

PROJECT_ROOT_DIR="$(pwd)"
SERVICES_DIR="${PROJECT_ROOT_DIR}/services"
BACKEND_DIR="${SERVICES_DIR}/backend"
UI_DIR="${SERVICES_DIR}/ui"

uv --directory "${BACKEND_DIR}" run python -c "import app.main; import json; print(json.dumps(app.main.app.openapi()))" > "${UI_DIR}/openapi.json"
bun run --cwd "${UI_DIR}" generate-client
