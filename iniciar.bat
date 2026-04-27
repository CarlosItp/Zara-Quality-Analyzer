@echo off
title Zara Quality Analyzer
echo.
echo =============================================
echo   Zara Quality Analyzer - Claude Haiku 4.5
echo =============================================
echo.

REM Verificar Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no encontrado. Descargalo en https://nodejs.org
    pause
    exit /b
)

REM Matar cualquier proceso que use el puerto 3000
echo [1/3] Liberando puerto 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3000 " ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)

REM Instalar dependencias si hace falta
echo [2/3] Verificando dependencias...
call npm install --silent

REM Arrancar servidor
echo [3/3] Iniciando servidor...
echo.
node server.js
pause
