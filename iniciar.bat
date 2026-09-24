@echo off
setlocal
cd /d "%~dp0"
title MIKIT - Prototipo Local

echo ==========================================
echo   MIKIT - Prototipo Local
echo   Se prepara todo y se abre el navegador.
echo ==========================================
echo.

REM ---------- 1. Verificar herramientas ----------
set "PY_CMD="
py -3 --version >nul 2>nul
if %errorlevel% EQU 0 set "PY_CMD=py -3"
if defined PY_CMD goto PY_FOUND
python --version >nul 2>nul
if %errorlevel% EQU 0 set "PY_CMD=python"
:PY_FOUND
if defined PY_CMD goto PY_READY
echo [ERROR] No se encontro Python 3.
echo Instala Python desde https://www.python.org/downloads/ y marca
echo la opcion "Add Python to PATH" durante la instalacion.
echo Luego volve a ejecutar este archivo.
pause
exit /b 1
:PY_READY
echo [OK] Python detectado: %PY_CMD%

where node >nul 2>nul
if %errorlevel% NEQ 0 goto NO_NODE
where npm.cmd >nul 2>nul
if %errorlevel% NEQ 0 goto NO_NODE
echo [OK] Node.js y npm detectados.
goto NODE_READY
:NO_NODE
echo [ERROR] No se encontro Node.js o npm.
echo Instala Node.js desde https://nodejs.org/ y volve a ejecutar.
pause
exit /b 1
:NODE_READY

where curl >nul 2>nul
if %errorlevel% NEQ 0 (
    echo [ERROR] No se encontro curl. Windows 10 y 11 lo incluyen por defecto.
    pause
    exit /b 1
)

REM ---------- 2. Entorno virtual de Python ----------
if exist "venv\Scripts\python.exe" goto VENV_READY
echo [Paso 1/4] Creando el entorno virtual...
%PY_CMD% -m venv venv
if %errorlevel% NEQ 0 (
    echo [ERROR] Fallo al crear el entorno virtual.
    pause
    exit /b 1
)
echo [Paso 1/4] Instalando dependencias de Python...
"venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
if %errorlevel% NEQ 0 (
    echo [ERROR] Fallo al instalar las dependencias de Python.
    pause
    exit /b 1
)
:VENV_READY
echo [OK] Entorno de Python listo.

REM ---------- 3. Dependencias de Node ----------
if exist "node_modules\" goto NPM_READY
echo [Paso 2/4] Instalando dependencias de Node...
call npm install
if %errorlevel% NEQ 0 (
    echo [ERROR] Fallo npm install.
    pause
    exit /b 1
)
:NPM_READY
echo [OK] Dependencias de Node listas.

REM ---------- 4. Build del frontend ----------
if exist "dist\index.html" if exist "dist\assets" goto BUILD_READY
echo [Paso 3/4] Compilando el frontend, puede tardar unos segundos...
call npm run build
if %errorlevel% NEQ 0 (
    echo [ERROR] Fallo el build del frontend.
    pause
    exit /b 1
)
:BUILD_READY
echo [OK] Frontend compilado.

REM ---------- 5. Verificar puerto 8000 ----------
echo [Paso 4/4] Verificando el puerto 8000...
set "code=000"
for /f %%c in ('curl -s -o nul -w "%%{http_code}" --max-time 3 "http://127.0.0.1:8000/" 2^>nul') do set "code=%%c"
if "%code%"=="000" goto PORT_FREE
echo.
echo [AVISO] El puerto 8000 ya esta en uso. Respuesta HTTP: %code%.
echo Puede ser otra instancia de MIKIT o alguna otra aplicacion.
echo Se abre el navegador de todos modos. Si la app no responde,
echo revisa que el servicio actual en el puerto 8000 sea MIKIT.
echo.
start "" "http://127.0.0.1:8000"
pause
exit /b 0
:PORT_FREE
echo [OK] Puerto 8000 libre.

REM ---------- 6. Lanzar el backend ----------
echo.
echo Iniciando MIKIT en http://127.0.0.1:8000 ...
echo Deja esta ventana abierta mientras usas la app.
echo Para detener: Ctrl+C o cerrar esta ventana.
echo.
start "" /b "venv\Scripts\python.exe" backend\main.py

REM ---------- 7. Esperar readiness ----------
echo Esperando a que el backend responda...
set /a tries=0
:WAIT_READY
set /a tries+=1
if %tries% GTR 30 goto READY_TIMEOUT
set "code=000"
for /f %%c in ('curl -s -o nul -w "%%{http_code}" --max-time 2 "http://127.0.0.1:8000/" 2^>nul') do set "code=%%c"
if "%code%"=="200" goto READY_OK
timeout /t 1 /nobreak >nul 2>nul
goto WAIT_READY
:READY_TIMEOUT
echo.
echo [ERROR] El backend no respondio en 30 segundos.
echo Revisa los mensajes de error de mas arriba y volve a intentar.
pause
exit /b 1
:READY_OK
echo [OK] Backend listo.

REM ---------- 8. Abrir navegador y mantenerse vivo ----------
echo.
start "" "http://127.0.0.1:8000"
echo La app se abrio en el navegador.
echo Mientras esta ventana este abierta, el backend queda corriendo.
echo.
:STAY_ALIVE
set "code=000"
for /f %%c in ('curl -s -o nul -w "%%{http_code}" --max-time 2 "http://127.0.0.1:8000/" 2^>nul') do set "code=%%c"
if "%code%"=="000" goto BACKEND_DOWN
timeout /t 2 /nobreak >nul 2>nul
goto STAY_ALIVE
:BACKEND_DOWN
echo.
echo El backend se detuvo. Ya podes cerrar esta ventana.
pause
exit /b 0