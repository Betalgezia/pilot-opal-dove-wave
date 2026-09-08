@echo off
setlocal EnableExtensions
title Relay
cd /d "%~dp0"

echo.
echo  === Relay ===
echo  Панель: http://localhost:8080
echo  Ядро:   %%LOCALAPPDATA%%\Relay\
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [Relay] Node.js не найден.
  echo          Скачайте LTS с https://nodejs.org , установите, перезапустите этот файл.
  pause
  exit /b 1
)

node -e "process.exit(Number(process.versions.node.split('.')[0])>=20?0:1)"
if errorlevel 1 (
  echo [Relay] Нужен Node.js 20 или новее. Сейчас:
  node -v
  echo          Обновите Node с https://nodejs.org
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [Relay] Не вижу package.json. Запускайте bat из папки проекта.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [Relay] Ставлю зависимости, это один раз и может занять пару минут...
  call npm install
  if errorlevel 1 (
    echo [Relay] npm install не удался. Проверьте интернет и повторите.
    pause
    exit /b 1
  )
)

echo [Relay] Если Windows Defender ругает mihomo.exe — добавьте папку
echo         %LOCALAPPDATA%\Relay в исключения защиты.
echo.

set "PORT_BUSY="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8080 .*LISTENING"') do set "PORT_BUSY=%%P"
if defined PORT_BUSY (
  echo [Relay] Порт 8080 уже занят (PID %PORT_BUSY%).
  echo          Открываю уже запущенную панель.
  start "" "http://localhost:8080"
  echo          Если это не Relay — закройте программу на 8080 и запустите bat снова.
  pause
  exit /b 1
)

echo [Relay] Запускаю панель. Браузер откроется сам. Окно не закрывайте.
echo.
call npx vite dev --host 0.0.0.0 --port 8080
set "ERR=%ERRORLEVEL%"
echo.
if not "%ERR%"=="0" (
  echo [Relay] Сервер остановился с кодом %ERR%.
  echo          Частые причины: нет интернета для npm, занят порт, антивирус режет mihomo.
)

pause
exit /b %ERR%
