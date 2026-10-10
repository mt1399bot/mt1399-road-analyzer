#!/usr/bin/env bash
# Build the public 20-round trial (excludes every member/admin route).
set -euo pipefail

cd "$(dirname "$0")/.."
PROJECT_ROOT="$PWD"

echo "=== Building MT1399 public 20-round trial ==="

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT
cp -a . "$TMP_DIR/src"
cd "$TMP_DIR/src"

echo "Removing private routes and stale build output..."
rm -rf dist dist-trial .next .vinxt .wrangler node_modules
rm -rf app/admin
rm -rf app/login
rm -rf app/api/admin
rm -rf app/api/member
rm -f app/admin-auth.ts
rm -f app/api-auth.ts
rm -f app/member-login.tsx
rm -f app/member-auth.ts
rm -f app/learning-auth.ts
rm -f app/password.ts

echo "Installing dependencies..."
npm ci

echo "Building..."
npm run build:app

echo "Copying clean trial build..."
rm -rf "$PROJECT_ROOT/dist" "$PROJECT_ROOT/dist-trial"
mkdir -p "$PROJECT_ROOT/dist" "$PROJECT_ROOT/dist-trial"
cp -a dist/. "$PROJECT_ROOT/dist/"
cp -a dist/. "$PROJECT_ROOT/dist-trial/"

if find "$PROJECT_ROOT/dist" -type f \( -iname '*admin*' -o -iname '*member-login*' \) | grep -q .; then
  echo "Private route artifacts were found in dist." >&2
  exit 1
fi

echo "=== Trial build complete: dist/ and dist-trial/ ==="
echo "Included APIs: /api/trial/status, /api/trial/use and /api/learning"
echo "Excluded: admin, login and member routes"
