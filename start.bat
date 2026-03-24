@echo off
setlocal

set "PORT=8080"
set "URL=http://localhost:%PORT%"

echo [INFO] Starting local game server on port %PORT%...
start "" "%URL%"
npx --yes http-server . -p %PORT% -c-1

endlocal
