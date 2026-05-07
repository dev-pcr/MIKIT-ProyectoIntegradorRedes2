import sys
import os

# Determinar si estamos corriendo como un ejecutable (PyInstaller) o como script
if getattr(sys, 'frozen', False):
    # Si es ejecutable, la ruta base es la carpeta temporal de extracción
    BASE_DIR = sys._MEIPASS
else:
    # Si es script, la ruta base es el directorio raíz del proyecto
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Localizar la carpeta FFmpeg (debe estar en el raíz del proyecto o del paquete)
ffmpeg_dir = os.path.join(BASE_DIR, "ffmpeg")

if os.path.exists(ffmpeg_dir):
    if ffmpeg_dir not in os.environ["PATH"]:
        os.environ["PATH"] = ffmpeg_dir + os.pathsep + os.environ["PATH"]
else:
    print(f"ADVERTENCIA: No se encontró la carpeta ffmpeg en {ffmpeg_dir}")

import json
import asyncio
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from groq import Groq
from dotenv import load_dotenv
import shutil
import tempfile
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os
from backend.utils.audio import process_and_split

# Cargar variables de entorno (API Keys, etc.)
load_dotenv()

app = FastAPI()

# Configuración de CORS para permitir peticiones desde el frontend (Vite corre en otro puerto)
# Configuración de rutas para PyInstaller
if getattr(sys, 'frozen', False):
    # Si estamos en el .exe, los archivos están en una carpeta temporal
    BASE_PROJECT_PATH = sys._MEIPASS
else:
    # Si estamos en desarrollo
    BASE_PROJECT_PATH = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Ruta a la carpeta dist (Frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Ruta a la carpeta dist (Frontend) con búsqueda robusta
log_files = os.listdir(BASE_PROJECT_PATH)
print(f"DEBUG: Archivos en raíz del ejecutable: {log_files}")

possible_paths = [
    BASE_PROJECT_PATH,
    os.path.join(BASE_PROJECT_PATH, "dist"),
    os.path.join(BASE_PROJECT_PATH, "backend", "dist")
]

dist_path = None
for p in possible_paths:
    # Verificación estricta: debe tener index.html Y la carpeta assets
    if os.path.exists(os.path.join(p, "index.html")) and os.path.exists(os.path.join(p, "assets")):
        dist_path = p
        print(f"DEBUG: Frontend REAL encontrado en: {dist_path}")
        break

if dist_path and os.path.exists(dist_path):
    # Solo montamos assets si la carpeta existe físicamente
    assets_dir = os.path.join(dist_path, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")
    
    @app.get("/")
    async def root():
        return FileResponse(os.path.join(dist_path, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        if full_path.startswith("transcribe") or full_path.startswith("save_") or full_path.startswith("assets"):
            return None
        
        file_path = os.path.join(dist_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(dist_path, "index.html"))
else:
    print(f"ERROR CRÍTICO: No se encontró una carpeta 'dist' válida en: {possible_paths}")

import time
import math

class KeyPool:
    def __init__(self, keys_data: list):
        # keys_data es una lista de dicts: {"alias": str, "key": str}
        self.keys = keys_data
        self.current_index = 0
        self.cooldowns = {} # alias -> timestamp hasta el que está bloqueada
        
    def get_current_key(self):
        if not self.keys:
            return None, None
        key_info = self.keys[self.current_index]
        return key_info.get("key"), key_info.get("alias")
    
    def rotate(self):
        if len(self.keys) <= 1:
            return False
        self.current_index = (self.current_index + 1) % len(self.keys)
        return True

    def mark_cooldown(self, alias, seconds):
        self.cooldowns[alias] = time.time() + seconds
        
    def get_wait_time(self):
        """Retorna el tiempo mínimo que debemos esperar hasta que alguna clave se libere."""
        if not self.cooldowns:
            return 0
        now = time.time()
        remaining = [t - now for t in self.cooldowns.values() if t > now]
        return min(remaining) if remaining else 0

    def get_next_available_key(self):
        """Busca la siguiente clave que no esté en cooldown."""
        start_index = self.current_index
        while True:
            key_info = self.keys[self.current_index]
            alias = key_info.get("alias")
            if self.cooldowns.get(alias, 0) <= time.time():
                return key_info.get("key"), alias
            
            self.current_index = (self.current_index + 1) % len(self.keys)
            if self.current_index == start_index:
                # Dimos la vuelta y todas están en cooldown
                return None, None

def run_groq_transcription(client, path):
    """
    Función auxiliar para llamar a la API de Groq.
    Usa el modelo whisper-large-v3 y solicita verbose_json para obtener marcas de tiempo.
    """
    with open(path, "rb") as audio_file:
        return client.audio.transcriptions.create(
            file=(os.path.basename(path), audio_file.read()),
            model="whisper-large-v3",
            response_format="verbose_json",
        )

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    api_key: str = Form(None),
    api_keys: str = Form(None) # JSON string con el pool de claves
):
    """
    Endpoint principal de transcripción con rotación de claves y manejo de Rate Limits.
    """
    print(f"\n--- INICIO DE TRANSCRIPCIÓN ---")
    
    # Preparar el pool de claves
    pool_data = []
    if api_keys:
        try:
            pool_data = json.loads(api_keys)
        except:
            print("ERROR: Fallo al parsear api_keys JSON")
    
    if not pool_data and api_key:
        pool_data = [{"alias": "Clave Activa", "key": api_key}]
        
    if not pool_data:
        # Fallback a env
        env_key = os.getenv("GROQ_API_KEY")
        if env_key:
            pool_data = [{"alias": "Default Env", "key": env_key}]

    if not pool_data:
        raise HTTPException(status_code=400, detail="Se requiere al menos una Groq API Key")

    pool = KeyPool(pool_data)

    async def event_generator():
        temp_dir = tempfile.mkdtemp()
        try:
            input_path = os.path.join(temp_dir, file.filename or "audio_input")
            with open(input_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            yield f"data: {json.dumps({'status': 'splitting', 'message': 'Fraccionando audio...'})}\n\n"
            chunk_paths = await asyncio.to_thread(process_and_split, input_path, temp_dir)
            total = len(chunk_paths)
            
            yield f"data: {json.dumps({'status': 'transcribing', 'total': total, 'current': 0, 'message': f'Iniciando transcripción de {total} partes...'})}\n\n"
            
            buffer_path = os.path.join(temp_dir, "transcription_buffer.txt")
            partial_error = None
            chunks_completed = 0
            
            accumulated_time = 0.0 # Offset global en segundos
            last_end_time = 0.0    # Marca de tiempo global del último segmento
            paragraph_threshold = 1.5 # Segundos de silencio para nuevo párrafo

            for i, chunk_data in enumerate(chunk_paths):
                path = chunk_data["path"]
                duration = chunk_data["duration"]
                current_chunk_success = False
                
                while not current_chunk_success:
                    key, alias = pool.get_next_available_key()
                    
                    if not key:
                        # Todas las claves están en cooldown
                        wait_needed = math.ceil(pool.get_wait_time())
                        if wait_needed > 0:
                            print(f"DEBUG: Todas las claves limitadas. Esperando {wait_needed}s...")
                            yield f"data: {json.dumps({'status': 'waiting_limit', 'chunk': i+1, 'wait': wait_needed, 'message': f'Límite global alcanzado. Esperando {wait_needed}s para continuar...'})}\n\n"
                            await asyncio.sleep(wait_needed)
                            continue # Reintentar obtener clave
                        else:
                            # Caso raro donde get_wait_time dice 0 pero get_next_available_key no devuelve nada
                            await asyncio.sleep(1)
                            continue

                    print(f"DEBUG: Transcribiendo fragmento {i+1}/{total} con clave: {alias}")
                    yield f"data: {json.dumps({'status': 'transcribing_chunk', 'chunk': i+1, 'total': total, 'key_alias': alias, 'message': f'Transcribiendo parte {i+1} con clave {alias}...'})}\n\n"
                    
                    client = Groq(api_key=key)
                    try:
                        transcription = await asyncio.to_thread(run_groq_transcription, client, path)
                        
                        # Procesar los segmentos del JSON detallado
                        with open(buffer_path, "a", encoding="utf-8") as f:
                            for segment in transcription.segments:
                                # Acceso robusto compatible con dicts u objetos
                                s_start = segment['start'] if isinstance(segment, dict) else segment.start
                                s_end = segment['end'] if isinstance(segment, dict) else segment.end
                                s_text = segment['text'] if isinstance(segment, dict) else segment.text
                                
                                start_global = accumulated_time + s_start
                                end_global = accumulated_time + s_end
                                
                                # Si hay un silencio mayor al umbral, insertamos párrafo
                                if last_end_time > 0:
                                    silence = start_global - last_end_time
                                    if silence > paragraph_threshold:
                                        f.write("\n\n")
                                
                                f.write(s_text)
                                last_end_time = end_global
                        
                        chunks_completed += 1
                        current_chunk_success = True
                    except Exception as e:
                        error_detail = str(e).lower()
                        is_rate_limit = "429" in error_detail or "rate_limit" in error_detail
                        
                        if is_rate_limit:
                            # Intentar extraer retry-after
                            wait_time = 10 # Default
                            try:
                                # Groq client suele poner los headers en el objeto de excepción si es RateLimitError
                                if hasattr(e, 'response') and 'retry-after' in e.response.headers:
                                    wait_time = int(e.response.headers['retry-after'])
                            except:
                                pass
                            
                            print(f"WARNING: Límite alcanzado en clave {alias}. Bloqueando por {wait_time}s.")
                            pool.mark_cooldown(alias, wait_time)
                            
                            if len(pool.keys) > 1:
                                yield f"data: {json.dumps({'status': 'rotating_key', 'chunk': i+1, 'old_key': alias, 'message': f'Límite en {alias}. Rotando clave...'})}\n\n"
                                pool.rotate()
                            else:
                                # Si solo hay una clave, tenemos que esperar sí o sí
                                yield f"data: {json.dumps({'status': 'retrying', 'chunk': i+1, 'wait': wait_time, 'message': f'Límite alcanzado. Reintentando en {wait_time}s...'})}\n\n"
                                await asyncio.sleep(wait_time)
                        else:
                            # Error no relacionado con rate limit (ej. archivo corrupto, red)
                            partial_error = f"Error en fragmento {i+1}: {str(e)}"
                            print(f"ERROR FATAL en fragmento {i+1}: {str(e)}")
                            break
                
                # Al final de cada fragmento, actualizamos el tiempo acumulado
                accumulated_time += duration

                if partial_error:
                    break
            
            # Unir y finalizar
            yield f"data: {json.dumps({'status': 'joining_buffer', 'message': 'Leyendo memoria temporal...'})}\n\n"
            joined = ""
            if os.path.exists(buffer_path):
                with open(buffer_path, "r", encoding="utf-8") as f:
                    joined = f.read().strip()

            if partial_error:
                final_text = joined + f"\n\n---\n*(Transcripción parcial. Error: {partial_error})*"
            else:
                final_text = joined
            
            yield f"data: {json.dumps({'status': 'completed', 'text': final_text, 'message': 'Transcripción finalizada.'})}\n\n"
        
        except Exception as e:
            yield f"data: {json.dumps({'status': 'error', 'detail': str(e)})}\n\n"
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
            print("--- FIN DE TRANSCRIPCIÓN ---\n")

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/save_md")
async def save_md(data: dict):
    """
    Guarda un archivo Markdown en el escritorio del usuario, opcionalmente dentro de una carpeta.
    """
    try:
        title = data.get("title", "transcripcion")
        content = data.get("content", "")
        folder = data.get("folder", None)
        
        # Limpiar el nombre del archivo
        safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).strip()
        
        # Determinar la ruta base
        desktop_path = r"C:\Users\pablo\OneDrive\Desktop"
        if folder:
            safe_folder = "".join([c for c in folder if c.isalnum() or c in (' ', '-', '_')]).strip()
            base_dir = os.path.join(desktop_path, safe_folder)
            os.makedirs(base_dir, exist_ok=True)
        else:
            base_dir = desktop_path
        
        # Resolver colisión de nombres
        filename = f"{safe_title}.md"
        file_path = os.path.join(base_dir, filename)
        counter = 1
        while os.path.exists(file_path):
            filename = f"{safe_title} ({counter}).md"
            file_path = os.path.join(base_dir, filename)
            counter += 1
        
        with open(file_path, "w", encoding="utf-8-sig") as f:
            f.write(content)
            
        print(f"DEBUG: Archivo guardado en: {file_path}")
        return {"status": "success", "message": f"Archivo guardado: {filename}"}
    except Exception as e:
        print(f"ERROR al guardar en escritorio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save_audio")
async def save_audio(
    file: UploadFile = File(...),
    title: str = Form(...),
    folder: str = Form(None)
):
    """
    Convierte el audio a MP3 (22050Hz, 16bit, 96kbps) y lo guarda en el escritorio,
    opcionalmente dentro de una subcarpeta para exportaciones masivas.
    """
    temp_dir = tempfile.mkdtemp()
    try:
        # 1. Guardar el archivo original temporalmente
        input_path = os.path.join(temp_dir, file.filename or "temp_audio")
        with open(input_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # 2. Cargar con pydub, normalizar y exportar como MP3 con parámetros específicos
        from pydub import AudioSegment
        audio = AudioSegment.from_file(input_path)
        # Normalizar a 22050 Hz, 16 bits (sample_width=2 bytes)
        audio = audio.set_frame_rate(22050).set_sample_width(2)
        
        # 3. Limpiar nombre del archivo final
        safe_title = "".join([c for c in title if c.isalnum() or c in (' ', '-', '_')]).strip()
        
        # 4. Determinar carpeta de destino
        desktop_path = r"C:\Users\pablo\OneDrive\Desktop"
        if folder:
            safe_folder = "".join([c for c in folder if c.isalnum() or c in (' ', '-', '_')]).strip()
            base_dir = os.path.join(desktop_path, safe_folder)
            os.makedirs(base_dir, exist_ok=True)
        else:
            base_dir = desktop_path
        
        # 5. Resolver colisión de nombres
        filename = f"{safe_title}.mp3"
        output_path = os.path.join(base_dir, filename)
        counter = 1
        while os.path.exists(output_path):
            filename = f"{safe_title} ({counter}).mp3"
            output_path = os.path.join(base_dir, filename)
            counter += 1
        
        # 6. Exportar en 96kbps
        audio.export(output_path, format="mp3", bitrate="96k")
        
        print(f"DEBUG: Audio guardado como MP3 (22050Hz/96kbps): {output_path}")
        return {"status": "success", "message": f"Audio guardado: {filename}"}
    except Exception as e:
        print(f"ERROR al guardar audio en escritorio: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    import uvicorn
    # Iniciar el servidor en el puerto 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
