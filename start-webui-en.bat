@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

rem =====================================================
rem  EPUB Simplified-to-Traditional Chinese Converter
rem  Launch Web UI (Static Version)
rem
rem  Uses Python built-in http.server to start HTTP server
rem  Solves drag-and-drop upload issues under file:// protocol
rem =====================================================

rem ---- Configurable Parameters ----
set "HOST=127.0.0.1"
set "PORT=8000"
set "AUTO_OPEN_BROWSER=1"

rem ---- Auto-detect Python ----
set "PY="
where python >nul 2>nul && set "PY=python"
if "%PY%"=="" (
    if exist "venv\Scripts\python.exe" set "PY=venv\Scripts\python.exe"
)
if "%PY%"=="" (
    if exist "venv\python.exe" set "PY=venv\python.exe"
)

if "%PY%"=="" (
    echo [ERROR] Python not found.
    echo - Please install Python 3.x: https://www.python.org/downloads/
    pause
    exit /b 1
)

rem ---- Check if port is in use ----
:PORT_CHECK
set "INUSE="
set "PIDS="
for /f "tokens=5" %%P in ('netstat -ano ^| findstr ":%PORT%" ^| findstr LISTENING') do (
    set "INUSE=1"
    if defined PIDS (
        set "PIDS=!PIDS! %%P"
    ) else (
        set "PIDS=%%P"
    )
)

if not "!INUSE!"=="" (
    echo.
    echo [WARN] Port !PORT! is already in use.
    echo [INFO] LISTENING PIDs: !PIDS!
    echo.
    echo Please choose:
    echo   [1] Force kill occupying process - taskkill /F 
    set /a NEXT_PORT=!PORT!+1
    echo   [2] Skip to next port - use port [!NEXT_PORT!]
    echo   [3] Cancel
    echo.
    set /p CHOICE=Enter 1-3 then press Enter: 
    if "!CHOICE!"=="1" (
        echo.
        for %%P in (!PIDS!) do (
            echo Force killing PID: %%P
            taskkill /F /PID %%P >nul 2>&1
        )
        echo [OK] Terminated. Retrying...
        goto PORT_CHECK
    )
    if "!CHOICE!"=="2" (
        set /a PORT+=1
        goto PORT_CHECK
    )
    if "!CHOICE!"=="3" (
        echo [INFO] Cancelled.
        exit /b 0
    )
    echo [ERR] Invalid choice
    timeout /t 2 /nobreak >nul
    goto PORT_CHECK
)

rem ---- Start HTTP Server ----
echo.
echo ============================================
echo  EPUB S2T Converter - Static Web Version
echo ============================================
echo.
echo  Python: %PY%
echo  Server: http://%HOST%:%PORT%
echo  Root:   %CD%
echo.
echo  Press Ctrl+C to stop the server
echo.
echo ============================================
echo.

rem ---- Open browser first (before server blocks) ----
if "%AUTO_OPEN_BROWSER%"=="1" (
    start "" "http://%HOST%:%PORT%/"
)

rem ---- Run server in same window (blocking, keeps window open for logs) ----
"%PY%" -m http.server %PORT% --bind %HOST% --directory "%CD%"

endlocal