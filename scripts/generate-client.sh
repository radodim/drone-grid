#! /usr/bin/env bash

set -e
set -x

cd services/backend
uv run python -c "import app.main; import json; print(json.dumps(app.main.app.openapi()))" > ../../openapi.json
cd ../..
mv openapi.json ./services/ui/
bun run --filter ./services/ui generate-client
bun run lint