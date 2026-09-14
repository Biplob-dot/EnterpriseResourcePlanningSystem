#!/bin/bash
# Keeps the PlyERP production server alive on port 3000.
# - Checks /api/health every 15s and restarts the server if it stops responding.
# - Logs to /app/logs (persistent; /tmp is wiped on sandbox recycle).
# - Writes its own PID to /app/logs/keepalive.pid so monitoring can verify the
#   watchdog is genuinely alive instead of matching its own command line.
# - Uses port-based killing (fuser) so it can never kill itself.

APP=/app
LOGDIR="$APP/logs"
LOG="$LOGDIR/keepalive.log"
SVRLOG="$LOGDIR/server.log"
PIDFILE="$LOGDIR/keepalive.pid"

mkdir -p "$LOGDIR"
echo $$ > "$PIDFILE"
echo "$(date '+%F %T') watchdog started (pid $$)" >> "$LOG"

while true; do
  code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://localhost:3000/api/health)

  if [ "$code" != "200" ]; then
    echo "$(date '+%F %T') health=$code -> restarting" >> "$LOG"
    fuser -k 3000/tcp >/dev/null 2>&1
    sleep 3
    cd "$APP" || exit 1
    setsid nohup npx next start -p 3000 >>"$SVRLOG" 2>&1 </dev/null &
    sleep 15
    again=$(curl -s -o /dev/null -m 10 -w '%{http_code}' http://localhost:3000/api/health)
    echo "$(date '+%F %T') restarted, health=$again" >> "$LOG"
  fi

  sleep 15
done
