@echo off
chcp 65001 >nul
setlocal EnableExtensions EnableDelayedExpansion

rem =====================================================
rem  EPUB 簡轉繁轉換工具 - 啟動 Web UI（純靜態版）
rem
rem  使用 Python 內建 http.server 啟動 HTTP 伺服器
rem  Solves drag-and-drop upload issues under file:// protocol
rem =====================================================

rem ---- 可調整參數 ----
set "HOST=127.0.0.1"
set "PORT=8000"
set "AUTO_OPEN_BROWSER=1"

rem ---- 自動偵測 Python ----
set "PY="
where python >nul 2>nul && set "PY=python"
if "%PY%"=="" (
    if exist "venv\Scripts\python.exe" set "PY=venv\Scripts\python.exe"
)
if "%PY%"=="" (
    if exist "venv\python.exe" set "PY=venv\python.exe"
)

if "%PY%"=="" (
    echo [ERROR] 找不到 Python。
    echo - 請安裝 Python 3.x：https://www.python.org/downloads/
    pause
    exit /b 1
)

rem ---- 檢查埠口是否被占用 ----
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
    echo [WARN] 埠口 !PORT! 已被占用。
    echo [INFO] LISTENING PIDs: !PIDS!
    echo.
    echo 請選擇：
    echo   [1] 強制關閉占用的進程 - taskkill /F 
    set /a NEXT_PORT=!PORT!+1
    echo   [2] PORT +1 迴避 - 改用下一個埠 [!NEXT_PORT!]
    echo   [3] 取消
    echo.
    set /p CHOICE=輸入 1 - 3 後按 Enter: 
    if "!CHOICE!"=="1" (
        echo.
        for %%P in (!PIDS!) do (
            echo 強制關閉 PID: %%P
            taskkill /F /PID %%P >nul 2>&1
        )
        echo [OK] 已關閉，重新嘗試...
        goto PORT_CHECK
    )
    if "!CHOICE!"=="2" (
        set /a PORT+=1
        goto PORT_CHECK
    )
    if "!CHOICE!"=="3" (
        echo [INFO] 已取消。
        exit /b 0
    )
    echo [ERR] 無效的選擇
    timeout /t 2 /nobreak >nul
    goto PORT_CHECK
)

rem ---- 啟動 HTTP 伺服器 ----
echo.
echo ============================================
echo  EPUB 簡轉繁轉換工具 - 靜態網頁版
echo ============================================
echo.
echo  Python: %PY%
echo  伺服器: http://%HOST%:%PORT%
echo  根目錄: %CD%
echo.
echo  按 Ctrl+C 停止伺服器
echo.
echo ============================================
echo.

rem ---- 先開啟瀏覽器（在伺服器阻塞前執行） ----
if "%AUTO_OPEN_BROWSER%"=="1" (
    start "" "http://%HOST%:%PORT%/"
)

rem ---- 在同一視窗執行伺服器（阻塞，視窗保持開啟顯示 log） ----
"%PY%" -m http.server %PORT% --bind %HOST% --directory "%CD%"

endlocal
