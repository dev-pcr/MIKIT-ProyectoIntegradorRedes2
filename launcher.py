import sys
import os
import subprocess
import time
import webview
import requests
import multiprocessing
import signal
import json

# Evitar bucles en Windows
if __name__ == '__main__':
    multiprocessing.freeze_support()

CREATE_NO_WINDOW = 0x08000000
DEBUG = '--debug' in sys.argv
backend_process = None

# Logger simple para depuración en producción
def log(message):
    try:
        log_path = os.path.join(os.path.expanduser("~"), "mikit_launcher.log")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}\n")
    except:
        pass

def get_base_path():
    if getattr(sys, 'frozen', False):
        return sys._MEIPASS
    return os.path.dirname(os.path.abspath(__file__))

def start_backend():
    global backend_process
    base_dir = get_base_path()
    
    if getattr(sys, 'frozen', False):
        server_cmd = [sys.executable, "--backend"]
    else:
        server_cmd = [sys.executable, os.path.join(base_dir, "backend", "main.py")]

    log(f"Iniciando backend: {server_cmd}")
    if DEBUG:
        backend_process = subprocess.Popen(server_cmd)
    else:
        backend_process = subprocess.Popen(
            server_cmd,
            creationflags=CREATE_NO_WINDOW,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL
        )
    log(f"Backend iniciado con PID: {backend_process.pid}")

def cleanup():
    global backend_process
    log("Iniciando limpieza de procesos...")
    if backend_process:
        try:
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(backend_process.pid)], 
                         creationflags=CREATE_NO_WINDOW, capture_output=True)
            log("Backend terminado con taskkill")
        except Exception as e:
            log(f"Error en taskkill: {str(e)}")
            try:
                backend_process.terminate()
                backend_process.wait(timeout=3)
            except:
                pass
        # Dar tiempo al SO para liberar archivos antes de que PyInstaller limpie _MEI
        time.sleep(1)
    log("Limpieza completada.")

def launch_ui():
    start_backend()
    
    url = 'http://127.0.0.1:8000/'
    log(f"Esperando backend en {url}...")
    
    # Esperar a que el motor esté listo
    ready = False
    for i in range(30):
        try:
            requests.get(url, timeout=0.5)
            ready = True
            log(f"Backend listo en el intento {i}")
            break
        except:
            time.sleep(0.5)
    
    if not ready:
        log("ERROR: El backend nunca respondió")

    # Directorio de datos persistente
    home = os.path.expanduser("~")
    app_data = os.path.join(home, "Documents", "MIKIT_Data")
    
    if not os.path.exists(app_data):
        try:
            os.makedirs(app_data)
            log(f"Creado directorio de datos: {app_data}")
        except Exception as e:
            log(f"Error creando directorio: {str(e)}")
    else:
        log(f"Usando directorio de datos existente: {app_data}")

    # Test de persistencia de archivos
    test_file = os.path.join(app_data, "last_run.log")
    if os.path.exists(test_file):
        with open(test_file, "r") as f:
            last_run = f.read()
        log(f"Persistencia de archivos: El archivo anterior existe. Última ejecución: {last_run}")
    
    with open(test_file, "w") as f:
        f.write(time.strftime('%Y-%m-%d %H:%M:%S'))

    icon_path = os.path.join(get_base_path(), 'LOGO.png')
    log(f"Ruta del icono: {icon_path} (existe: {os.path.exists(icon_path)})")

    # Configurar la ventana principal (sin icon aquí, va en webview.start)
    window = webview.create_window(
        'MIKIT v1.0 — Transcriptor & Grabador', 
        url, 
        width=1280, 
        height=800,
        min_size=(1000, 700),
        background_color='#09090b'
    )
    
    log(f"Iniciando WebView con storage_path={app_data}")
    try:
        webview.start(storage_path=app_data, private_mode=False, debug=DEBUG)
    except Exception as e:
        log(f"Error en webview.start: {str(e)}")
    finally:
        cleanup()

if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == "--backend":
        try:
            from backend.main import app
            import uvicorn
            uvicorn.run(app, host="127.0.0.1", port=8000, log_level="error")
        except Exception as e:
            log(f"Error en servidor backend: {str(e)}")
    else:
        launch_ui()
