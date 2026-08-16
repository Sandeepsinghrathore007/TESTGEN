@echo off
setlocal EnableExtensions

rem LearnLedger one-click development launcher for Windows 10+.
rem Resolve paths relative to this .bat file.
set "LAUNCHER_DIR=%~dp0"
if exist "%LAUNCHER_DIR%package.json" (
  set "PROJECT_DIR=%LAUNCHER_DIR%"
) else if exist "%LAUNCHER_DIR%Learnledger\package.json" (
  set "PROJECT_DIR=%LAUNCHER_DIR%Learnledger"
) else (
  set "PROJECT_DIR=%LAUNCHER_DIR%"
)
for %%I in ("%PROJECT_DIR%.") do set "PROJECT_DIR=%%~fI"

set "OMNIROUTE_URL=http://localhost:20128"
set "OMNIROUTE_HEALTH_URL=http://localhost:20128/api/monitoring/health"
set "OMNIROUTE_PORT=20128"
set "VITE_URL=http://127.0.0.1:5173/"
set "VITE_PORT=5173"
set "OMNIROUTE_WAIT_SECONDS=10"
set "VITE_WAIT_SECONDS=30"
set "NPM_CMD=npm.cmd"
set "LOCAL_OMNIROUTE_CMD=%PROJECT_DIR%\node_modules\.bin\omniroute.cmd"

echo.
echo ==========================================
echo   LearnLedger development launcher
echo ==========================================
echo Project directory: "%PROJECT_DIR%"

pushd "%PROJECT_DIR%" || (
  echo [ERROR] Could not open the project directory:
  echo         "%PROJECT_DIR%"
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [ERROR] package.json was not found in:
  echo         "%PROJECT_DIR%"
  popd
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found in this Command Prompt environment.
  popd
  pause
  exit /b 1
)

where %NPM_CMD% >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm.cmd was not found in this Command Prompt environment.
  popd
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo [ERROR] Project dependencies are missing. Run "npm install" first.
  popd
  pause
  exit /b 1
)

rem --- START VITE DEV SERVER FIRST ---
echo.
echo [CHECKING] Checking if Vite dev server is already running...
call :is_http_available "%VITE_URL%"
if not errorlevel 1 (
  echo [OK] Vite is already running at %VITE_URL%
  goto :open_browser
)

call :is_port_in_use %VITE_PORT%
if not errorlevel 1 (
  echo [ERROR] Port %VITE_PORT% is already in use by another process.
  echo Please close that process or free the port, then try again.
  popd
  pause
  exit /b 1
)

echo [STARTING] Starting Vite dev server in a separate window...
start "LearnLedger - Vite" /D "%PROJECT_DIR%" cmd /k "%NPM_CMD%" run dev -- --host 127.0.0.1 --port %VITE_PORT% --strictPort

echo [WAITING] Waiting for Vite to become ready...
call :wait_for_http "%VITE_URL%" %VITE_WAIT_SECONDS%
if errorlevel 1 (
  echo [ERROR] Vite dev server did not become ready at %VITE_URL% within %VITE_WAIT_SECONDS% seconds.
  echo Please check the Vite window for any compilation or package errors.
  popd
  pause
  exit /b 1
)

:open_browser
echo [OK] Frontend is ready at %VITE_URL%
echo [OPENING] Opening frontend in Brave browser...
call :open_url_in_brave "%VITE_URL%"

rem --- START OMNIROUTE NEXT (OPTIONAL) ---
echo.
echo [CHECKING] Checking if OmniRoute is already running...
call :is_http_available "%OMNIROUTE_HEALTH_URL%"
if not errorlevel 1 (
  echo [OK] OmniRoute is already running at %OMNIROUTE_URL%
  goto :finish
)

call :is_port_in_use %OMNIROUTE_PORT%
if not errorlevel 1 (
  echo [INFO] Port %OMNIROUTE_PORT% is already in use. Skipping starting OmniRoute.
  goto :finish
)

call :resolve_omniroute_command
if errorlevel 1 (
  echo [INFO] OmniRoute binary not found. Skipping OmniRoute startup.
  goto :finish
)

echo [STARTING] Starting OmniRoute in a separate window...
start "LearnLedger - OmniRoute" /D "%PROJECT_DIR%" cmd /k call "%OMNIROUTE_CMD%" serve --port %OMNIROUTE_PORT% --no-open

echo [WAITING] Waiting briefly for OmniRoute to warm up...
call :wait_for_http "%OMNIROUTE_HEALTH_URL%" %OMNIROUTE_WAIT_SECONDS%
if errorlevel 1 (
  echo [INFO] OmniRoute did not answer health checks in time, but the app remains usable.
) else (
  echo [OK] OmniRoute is ready at %OMNIROUTE_URL%
)

:finish
popd
echo.
echo Startup completed successfully! Keep the background windows running.
timeout /t 5
exit /b 0

:resolve_omniroute_command
set "OMNIROUTE_CMD="
if exist "%LOCAL_OMNIROUTE_CMD%" (
  set "OMNIROUTE_CMD=%LOCAL_OMNIROUTE_CMD%"
  exit /b 0
)
where omniroute.cmd >nul 2>&1
if not errorlevel 1 (
  set "OMNIROUTE_CMD=omniroute.cmd"
  exit /b 0
)
exit /b 1

:is_http_available
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest -UseBasicParsing -Uri '%~1' -TimeoutSec 2 | Out-Null; exit 0 } catch { if ($_.Exception.Response) { exit 0 }; exit 1 }" >nul 2>&1
exit /b %errorlevel%

:is_port_in_use
powershell -NoProfile -ExecutionPolicy Bypass -Command "$listener = Get-NetTCPConnection -State Listen -LocalPort %~1 -ErrorAction SilentlyContinue | Select-Object -First 1; if ($null -ne $listener) { exit 0 }; exit 1" >nul 2>&1
exit /b %errorlevel%

:open_url_in_brave
set "BRAVE_PATH="
for /f "tokens=2,*" %%A in ('reg query "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\brave.exe" /ve 2^>nul') do set "BRAVE_PATH=%%B"
if not defined BRAVE_PATH (
  for /f "tokens=2,*" %%A in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\App Paths\brave.exe" /ve 2^>nul') do set "BRAVE_PATH=%%B"
)
if not defined BRAVE_PATH (
  if exist "%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BRAVE_PATH=%ProgramFiles%\BraveSoftware\Brave-Browser\Application\brave.exe"
  ) else if exist "%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BRAVE_PATH=%ProgramFiles(x86)%\BraveSoftware\Brave-Browser\Application\brave.exe"
  ) else if exist "%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe" (
    set "BRAVE_PATH=%LocalAppData%\BraveSoftware\Brave-Browser\Application\brave.exe"
  )
)
if defined BRAVE_PATH (
  start "" "%BRAVE_PATH%" "%~1"
) else (
  echo [INFO] Brave browser not found. Opening in default browser instead.
  start "" "%~1"
)
exit /b 0

:wait_for_http
set "WAIT_URL=%~1"
set /a "WAIT_REMAINING=%~2"

:wait_loop
call :is_http_available "%WAIT_URL%"
if not errorlevel 1 exit /b 0

set /a WAIT_REMAINING-=1
if %WAIT_REMAINING% LEQ 0 exit /b 1
timeout /t 1 /nobreak >nul
goto :wait_loop
