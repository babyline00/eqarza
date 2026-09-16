#!/usr/bin/env bash
# ------------------------------------------------------------------
# E-Qarza deploy self-check — verifies the standalone bundle was
# extracted COMPLETELY (cPanel's File Manager "Extract" is known to
# silently drop entries whose names contain brackets like
# [root-of-the-server]__*.js, which then fails at boot with
# "ChunkLoadError: Cannot find module ... [root-of-the-server]__*").
#
# Usage (from the host, in the bundle root, e.g. ~/eqarza.online):
#     bash deploy/check-deploy.sh
# Optionally pass the app dir:  bash deploy/check-deploy.sh /path/app
#
# Exit code 0 = extraction complete + server boots, non-zero = problem.
# ------------------------------------------------------------------
set -u

BASE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP="${1:-$BASE/app}"

PASS=0
FAIL=0
ok()   { echo "  [ok]   $1"; PASS=$((PASS+1)); }
bad()  { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }

echo "== E-Qarza deploy check =="
echo "  bundle root : $BASE"
echo "  app dir     : $APP"
echo

# --- 1. Next build artifacts -------------------------------------------------
if [ -f "$APP/.next/BUILD_ID" ]; then
  ok   "BUILD_ID present: $(tr -d '\n' < "$APP/.next/BUILD_ID")"
else
  bad  "Missing $APP/.next/BUILD_ID (no build — did app/ get extracted?)"
fi

if [ -d "$APP/node_modules/next" ]; then
  ok "node_modules/next present"
else
  bad "Missing app/node_modules/next"
fi
if [ -f "$APP/server.js" ]; then
  ok "server.js present"
else
  bad "Missing app/server.js"
fi

# --- 2. Chunk inventory (the cPanel extraction pain point) -------------------
SSR_DIR="$APP/.next/server/chunks/ssr"
N_JS=0; N_SPECIAL=0; N_PAGE=0
if [ -d "$SSR_DIR" ]; then
  N_JS=$(find "$SSR_DIR" -maxdepth 1 -name '*.js' | wc -l)
  # entries with special chars (bracket / tilde / reordered-token names)
  N_SPECIAL=$(find "$SSR_DIR" -maxdepth 1 -name '*[*~_]*.js' | wc -l)
  echo "  ssr chunks found   : $N_JS  (special-named: $N_SPECIAL)"
  if [ "$N_JS" -ge 30 ]; then
    ok "ssr chunk directory looks complete ($N_JS files)"
  else
    bad "Only $N_JS ssr chunks — extraction likely incomplete (expect >= 1500)"
  fi
  # the runtime entry every page requires
  if [ -f "$SSR_DIR/[turbopack]_runtime.js" ]; then
    ok "[turbopack]_runtime.js present"
  else
    bad "Missing [turbopack]_runtime.js"
  fi
else
  bad "No $SSR_DIR directory"
fi

# --- 3. Server-side page bundle ---------------------------------------------
EDGE="$(find "$APP/.next/server" -type f -name 'index.js' -path '*app/*' 2>/dev/null | wc -l)"
if [ "$EDGE" -ge 1 ]; then
  ok "server app bundles present"
else
  bad "No server app bundles under .next/server/app"
fi

# --- 4. Data + uploads -------------------------------------------------------
if [ -f "$BASE/data/custom.db" ]; then
  sz=$(wc -c < "$BASE/data/custom.db")
  ok "data/custom.db present ($sz bytes)"
else
  bad "Missing $BASE/data/custom.db"
fi
[ -d "$BASE/uploads" ] && ok "uploads/ dir present" || bad "Missing $BASE/uploads/"

# --- 5. Boot test (real) -----------------------------------------------------
echo
echo "== booting standalone for a live check (port 3199) =="
PORT=3199 NODE_ENV=production DATABASE_URL="file:$BASE/data/custom.db" \
  node "$APP/server.js" > "$BASE/.check-server.out" 2>&1 &
SRV=$!
B=0
until curl -s -o /dev/null http://127.0.0.1:3199/ ; do
  sleep 1; B=$((B+1))
  [ $B -ge 20 ] && break
  if [ $B -ge 12 ]; then
    tail -3 "$BASE/.check-server.out" | grep -q "ChunkLoadError\|MODULE_NOT_FOUND" && break
  fi
done

try() {
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:3199$1" -H "Authorization: Bearer")
  echo "  GET $1 -> $code"
  [ "$code" != "000" ] && [ "$code" != "500" ]
}

if try /            && try /admin          && try /api/videos; then
  ok "server boots: /admin/pages + videos API answer (no ChunkLoadError)"
else
  echo "--- server log tail ---"
  tail -15 "$BASE/.check-server.out"
  bad "server failed to boot/serve (see log above)"
fi
kill $SRV 2>/dev/null
wait $SRV 2>/dev/null
rm -f "$BASE/.check-server.out"

echo
echo "== RESULT: $PASS ok, $FAIL failed =="
[ $FAIL -eq 0 ] && echo "== EXTRACTION COMPLETE — READY TO GO LIVE ==" || echo "== RE-EXTRACT REQUIRED (use terminal/SSH unzip, not the File Manager) =="
exit $FAIL
