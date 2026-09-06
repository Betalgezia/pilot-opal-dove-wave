@echo off
title Relay
cd /d "%~dp0"
call npx vite dev --host 0.0.0.0 --port 8080
pause
