#!/usr/bin/env bash
# Arranca o simulador de IRS e abre o browser automaticamente (Linux/Mac).
set -e
cd "$(dirname "$0")"
PORT=8000

echo "A iniciar o simulador de IRS em http://localhost:$PORT ..."
python3 -m http.server "$PORT" >/dev/null 2>&1 &
SERVER_PID=$!
trap "kill $SERVER_PID 2>/dev/null" EXIT

sleep 1

if command -v open >/dev/null 2>&1; then
  open "http://localhost:$PORT"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "http://localhost:$PORT"
else
  echo "Abre manualmente no browser: http://localhost:$PORT"
fi

echo "Aplicação em execução. Fecha esta janela ou prime Ctrl+C para parar."
wait $SERVER_PID
