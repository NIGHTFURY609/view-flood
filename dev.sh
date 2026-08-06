#!/usr/bin/env bash
#
# Runs the FastAPI backend and the Vite frontend together for local development.
#
#   ./dev.sh
#
# The backend must be on port 8000: vite.config.ts proxies /api there, so the
# frontend talks to it through http://localhost:5173/api with no CORS involved.
# Override with API_PORT / WEB_PORT if something else already owns a port.
#
# Ctrl+C stops both.

set -euo pipefail

cd "$(dirname "$0")"

API_PORT="${API_PORT:-8000}"
WEB_PORT="${WEB_PORT:-5173}"

# --- locate the python interpreter -------------------------------------------
# .venv/Scripts on Windows, .venv/bin elsewhere. Falls back to `uv run`, which
# is what render.yaml uses, so a missing venv is not fatal.
if [ -x "api/.venv/Scripts/python.exe" ]; then
  PY=(./.venv/Scripts/python.exe)
elif [ -x "api/.venv/bin/python" ]; then
  PY=(./.venv/bin/python)
elif command -v uv >/dev/null 2>&1; then
  PY=(uv run python)
else
  echo "No api/.venv and no uv on PATH. Create the venv first:" >&2
  echo "  cd api && uv sync" >&2
  exit 1
fi

if [ ! -f "api/.env" ]; then
  echo "Warning: api/.env not found — the API will start but writes will 503." >&2
fi

if [ ! -d "node_modules" ]; then
  echo "node_modules missing. Run: npm install" >&2
  exit 1
fi

# --- teardown ----------------------------------------------------------------
API_PID=""
WEB_PID=""

# Both servers spawn children: uvicorn --reload runs a worker under a reloader,
# and npm runs vite under a shim. Killing the job we launched leaves the child
# alive and still holding the port. Worse, under Git Bash `$!` is an MSYS
# pseudo-PID that Windows tooling cannot resolve at all. So the reliable signal
# is the port itself: whatever is listening on it is what we started.
kill_port() {
  local port="$1" pid
  if command -v taskkill >/dev/null 2>&1; then
    # netstat is the one PID source that agrees with taskkill on Windows.
    for pid in $(netstat -ano 2>/dev/null \
                   | tr -d '\r' \
                   | awk -v p=":$port" '$4=="LISTENING" && $2 ~ p"$" {print $5}' \
                   | sort -u); do
      MSYS_NO_PATHCONV=1 taskkill /PID "$pid" /T /F >/dev/null 2>&1 || true
    done
  elif command -v lsof >/dev/null 2>&1; then
    for pid in $(lsof -ti ":$port" -sTCP:LISTEN 2>/dev/null); do
      kill -9 "$pid" 2>/dev/null || true
    done
  fi
}

cleanup() {
  trap - EXIT INT TERM
  # Ask nicely first, so a clean shutdown still gets to run.
  [ -n "$API_PID" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "$WEB_PID" ] && kill "$WEB_PID" 2>/dev/null || true
  sleep 1
  kill_port "$API_PORT"
  kill_port "$WEB_PORT"
  wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

# --- backend -----------------------------------------------------------------
echo "api  -> http://127.0.0.1:${API_PORT}  (docs at /api/docs)"
(
  cd api
  exec "${PY[@]}" -m uvicorn app.main:app \
    --host 127.0.0.1 \
    --port "$API_PORT" \
    --reload
) &
API_PID=$!

# --- frontend ----------------------------------------------------------------
echo "web  -> http://localhost:${WEB_PORT}"
echo
VITE_API_PROXY_TARGET="http://127.0.0.1:${API_PORT}" \
  npm run dev --workspace web -- --port "$WEB_PORT" &
WEB_PID=$!

# Exit as soon as either side dies, rather than leaving half a stack running.
wait -n "$API_PID" "$WEB_PID"
echo
echo "One process exited — shutting the other down." >&2
