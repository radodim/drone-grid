#! /usr/bin/env bash
set -e
set -x

# Bring DB schema to head before the app starts. `set -e` ensures a failed
# migration aborts container startup so we never serve traffic against a
# half-migrated DB.
alembic upgrade head
