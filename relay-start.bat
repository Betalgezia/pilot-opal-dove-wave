@echo off
setlocal EnableExtensions
cd /d "%~dp0"
if errorlevel 1 (
  echo [relay] failed to cd to script folder
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [relay] Node.js not found.
  echo         Install LTS from https://nodejs.org and run this file again.
  pause
  exit /b 1
)

echo [relay] starting from:
cd
echo.

node "%~dp0scripts\relay-start.mjs"
set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" echo [relay] stopped with code %ERR%
pause
exit /b %ERR%
