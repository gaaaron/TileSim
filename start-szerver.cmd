@echo off
chcp 65001 >nul
title TileSim szerver
cd /d "%~dp0"

echo ====================================
echo   TileSim - szerver inditasa
echo ====================================
echo.

where npm >nul 2>nul
if errorlevel 1 (
  echo [HIBA] Az "npm" nem talalhato. Telepitsd a Node.js-t: https://nodejs.org
  echo.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo Fuggosegek telepitese ^(elso inditas, eltarthat egy kicsit^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo [HIBA] A telepites nem sikerult.
    pause
    exit /b 1
  )
)

echo Szerver indul es megnyilik a bongeszo...
echo A leallitashoz zard be ezt az ablakot, vagy nyomj Ctrl+C-t.
echo.
call npm run dev -- --open

echo.
echo A szerver leallt.
pause
