#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

# Dependencies are managed by the workspace. Running npm ci here can force a
# network download after every merge and fail on packages blocked by the
# environment security policy. The merge process already reconciles packages;
# this hook only performs the deterministic application verification.
npm run build