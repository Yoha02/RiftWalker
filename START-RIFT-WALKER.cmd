@echo off
setlocal
cd /d "%~dp0"
title Rift Walker local server
set "RIFT_NODE=C:\Program Files\nodejs\node.exe"
if not exist "%RIFT_NODE%" (
  echo Node.js was not found at C:\Program Files\nodejs\node.exe
  echo Install Node.js 20 or later, then run npm start from this folder.
  pause
  exit /b 1
)
echo Rift Walker - local practice mode works without a Gemini key.
echo Keep this window open while playing.
echo Open the exact URL printed after "Rift Walker is ready" below.
echo If port 4173 is busy, the server will choose the next available port.
echo Press Ctrl+C to stop the server.
echo.
"%RIFT_NODE%" server.mjs
echo.
echo The server stopped. Any error is shown above.
pause
