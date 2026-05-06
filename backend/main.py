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

def run_groq_transcription(client, path):
    """
    Función auxiliar para llamar a la API de Groq.
    Usa el modelo whisper-large-v3-turbo para máxima velocidad.
    """
    with open(path, "rb") as audio_file:
        return client.audio.transcriptions.create(
            file=(os.path.basename(path), audio_file.read()),
            model="whisper-large-v3",
            response_format="text",
        )

@app.post("/transcribe")
async def transcribe_audio(
    file: UploadFile = File(...),
    api_key: str = Form(None)
):
    """
    Endpoint principal de transcripción con logs detallados.
    """
    print(f"\n--- INICIO DE TRANSCRIPCIÓN ---")
    print(f"DEBUG: Archivo recibido: {file.filename} ({file.content_type})")
    
    key = api_key or os.getenv("GROQ_API_KEY")
    if not key:
        print("ERROR: No se encontró API Key")
        raise HTTPException(status_code=400, detail="Groq API Key is required")

    client = Groq(api_key=key)

    async def event_generator():
        temp_dir = tempfile.mkdtemp()
        print(f"DEBUG: Carpeta temporal creada: {temp_dir}")
        try:
            # 1. Guardar archivo
            input_path = os.path.join(temp_dir, file.filename or "audio_input")
            print(f"DEBUG: Guardando archivo en: {input_path}")
            with open(input_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            print(f"DEBUG: Archivo guardado con éxito. Tamaño: {os.path.getsize(input_path)} bytes")
            
            # 2. Fraccionar
            yield f"data: {json.dumps({'status': 'splitting', 'message': 'Fraccionando audio...'})}\n\n"
            print("DEBUG: Iniciando process_and_split...")
            chunk_paths = await asyncio.to_thread(process_and_split, input_path, temp_dir)
            total = len(chunk_paths)
            print(f"DEBUG: Fraccionamiento completado. Total de partes: {total}")
            
            # 3. Transcribir
            yield f"data: {json.dumps({'status': 'transcribing', 'total': total, 'current': 0, 'message': f'Iniciando transcripción de {total} partes...'})}\n\n"
            
            buffer_path = os.path.join(temp_dir, "transcription_buffer.txt")
            partial_error = None
            chunks_completed = 0

            for i, path in enumerate(chunk_paths):
                print(f"DEBUG: Transcribiendo fragmento {i+1}/{total}: {path}")
                yield f"data: {json.dumps({'status': 'transcribing_chunk', 'chunk': i+1, 'total': total, 'message': f'Transcribiendo fragmento {i+1} de {total}...'})}\n\n"
                
                max_retries = 3
                retry_count = 0
                success = False
                
                while retry_count < max_retries and not success:
                    try:
                        transcription = await asyncio.to_thread(run_groq_transcription, client, path)
                        # Escribir inmediatamente al buffer (disco) en lugar de solo RAM
                        with open(buffer_path, "a", encoding="utf-8") as f:
                            f.write(transcription + " ")
                        
                        chunks_completed += 1
                        success = True
                        print(f"DEBUG: Fragmento {i+1} completado (intento {retry_count + 1}).")
                    except Exception as chunk_err:
                        retry_count += 1
                        error_detail = str(chunk_err)
                        is_rate_limit = "rate_limit_exceeded" in error_detail.lower() or "429" in error_detail
                        
                        if is_rate_limit and retry_count < max_retries:
                            wait_time = 5 if retry_count == 1 else 15
                            print(f"DEBUG: Rate limit en fragmento {i+1}. Reintentando en {wait_time}s... (Intento {retry_count}/{max_retries})")
                            yield f"data: {json.dumps({'status': 'retrying', 'chunk': i+1, 'attempt': retry_count, 'max_attempts': max_retries, 'wait': wait_time, 'message': f'Límite alcanzado. Reintentando fragmento {i+1} en {wait_time}s...'})}\n\n"
                            await asyncio.sleep(wait_time)
                        else:
                            # Si no es rate limit o agotamos reintentos
                            if is_rate_limit:
                                error_detail = "Límite de la API de Groq alcanzado (se agotaron los reintentos)."
                            partial_error = f"Error en fragmento {i+1} de {total}: {error_detail}"
                            print(f"ERROR en fragmento {i+1}: {error_detail}")
                            break
                
                if not success:
                    break
            
            # 4. Unir
            print("DEBUG: Uniendo transcripciones finales desde buffer...")
            yield f"data: {json.dumps({'status': 'joining_buffer', 'message': 'Leyendo memoria temporal...'})}\n\n"
            
            joined = ""
            if os.path.exists(buffer_path):
                with open(buffer_path, "r", encoding="utf-8") as f:
                    joined = f.read().strip()
            print(f"DEBUG: Buffer leído. Longitud: {len(joined)} caracteres.")

            yield f"data: {json.dumps({'status': 'joining_processing', 'message': 'Normalizando texto...'})}\n\n"
            if partial_error:
                if joined.strip():
                    final_text = joined + f"\n\n---\n*(Transcripción parcial lograda hasta el fragmento {chunks_completed} de {total}. Ups, hubo un error y no pudimos continuar. Error: {partial_error})*"
                else:
                    final_text = f"*(No se pudo transcribir ningún fragmento. Ups, hubo un error desde el inicio. Error: {partial_error})*"
            else:
                final_text = joined
            
            yield f"data: {json.dumps({'status': 'joining_finalizing', 'message': 'Preparando respuesta final...'})}\n\n"
            print("DEBUG: Respuesta final preparada.")
            
            # 5. Completar
            print(f"DEBUG: Procesamiento finalizado. Tamaño total: {len(final_text)} caracteres.")
            yield f"data: {json.dumps({'status': 'completed', 'text': final_text, 'message': 'Transcripción finalizada.' if not partial_error else 'Transcripción parcial (ver notas al final).'})}\n\n"
        
        except Exception as e:
            import traceback
            error_trace = traceback.format_exc()
            print(f"ERROR CRÍTICO: {str(e)}")
            print(error_trace)
            
            error_msg = str(e)
            if "rate_limit_exceeded" in error_msg.lower() or "429" in error_msg:
                error_msg = "Límite de transcripciones alcanzado (Groq API)."
            
            yield f"data: {json.dumps({'status': 'error', 'detail': error_msg, 'trace': error_trace})}\n\n"
        finally:
            print(f"DEBUG: Limpiando carpeta temporal: {temp_dir}")
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
