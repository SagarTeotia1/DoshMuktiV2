#!/bin/bash
set -e

echo "[entrypoint] Starting Doshhmukti (Backend + Frontend + Admin + nginx)"

# Run once per deploy — set RUN_MIGRATIONS=false to skip (e.g. if running migrate
# deploy separately in CI before rolling out a new image).
if [ "${RUN_MIGRATIONS:-true}" = "true" ]; then
  echo "[entrypoint] Running prisma migrate deploy..."
  (cd /app/backend && node_modules/.bin/prisma migrate deploy)
fi

echo "[entrypoint] Starting Backend on :4000"
(cd /app/backend && PORT=4000 node dist/server.js) &
BACKEND_PID=$!

echo "[entrypoint] Starting Frontend on :3000"
(cd /app/frontend && PORT=3000 HOSTNAME=0.0.0.0 node server.js) &
FRONTEND_PID=$!

echo "[entrypoint] Starting Admin on :3001"
(cd /app/admin && PORT=3001 HOSTNAME=0.0.0.0 node server.js) &
ADMIN_PID=$!

# If any of the three Node processes dies, bring the whole container down so
# the orchestrator (systemd / docker restart policy) restarts it cleanly —
# a silently-half-dead container is worse than a visibly failed one.
trap 'kill $BACKEND_PID $FRONTEND_PID $ADMIN_PID 2>/dev/null' EXIT
( wait -n $BACKEND_PID $FRONTEND_PID $ADMIN_PID; echo "[entrypoint] A service exited — shutting down"; kill 0 ) &

echo "[entrypoint] Starting nginx"
exec nginx -g 'daemon off;'
