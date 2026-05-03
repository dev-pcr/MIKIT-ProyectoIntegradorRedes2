import os
from pydub import AudioSegment
from pydub.silence import split_on_silence
import math

# pydub detectará ffmpeg y ffprobe automáticamente si están en el PATH del sistema
# (que ya inyectamos en main.py)
from pydub.silence import detect_silence

def process_and_split(input_path, temp_dir):
    """
    Punto de entrada principal para el procesamiento de audio.
    1. Carga el archivo.
    2. Lo normaliza (Mono, 16kHz).
    3. Lo divide en partes de ~10 minutos buscando silencios para no cortar palabras.
    4. Guarda cada parte en el directorio temporal y retorna sus rutas.
    """
    # Cargar audio original
    audio = AudioSegment.from_file(input_path)
    # Normalizar a los parámetros óptimos de Groq (Mono, 16kHz)
    audio = audio.set_channels(1).set_frame_rate(16000)
    
    max_ms = 10 * 60 * 1000 # Límite de 10 minutos por fragmento
    total_len = len(audio)
    
    # Si el archivo es corto, generar un solo fragmento directamente
    if total_len <= max_ms:
        path = os.path.join(temp_dir, "chunk_0.mp3")
        audio.export(path, format="mp3", bitrate="64k")
        return [path]
    
    chunk_paths = []
    current_start = 0
    chunk_count = 0
    
    # Iterar sobre el audio para crear fragmentos inteligentes
    while current_start < total_len:
        # El final teórico es 10 minutos después del inicio actual
        target_end = min(current_start + max_ms, total_len)
        
        if target_end < total_len:
            # Buscamos un silencio en los últimos 20 segundos del bloque de 10 min
            # para evitar cortar una frase por la mitad.
            search_window_start = max(current_start, target_end - 60000)
            window = audio[search_window_start:target_end]
            
            # Detectar silencios de al menos 500ms con un umbral de -40dBFS
            silences = detect_silence(window, min_silence_len=500, silence_thresh=-40)
            
            if silences:
                # Tomamos el último silencio de la ventana para maximizar el tamaño del chunk
                last_silence_start, last_silence_end = silences[-1]
                # El punto de corte será la mitad del silencio detectado
                actual_end = search_window_start + last_silence_start + (last_silence_end - last_silence_start) // 2
            else:
                # Si no se encuentra silencio en esos 60s, cortamos en el límite exacto
                actual_end = target_end
        else:
            # Es el último fragmento del archivo
            actual_end = total_len
            
        # Extraer el segmento y exportarlo
        chunk = audio[current_start:actual_end]
        path = os.path.join(temp_dir, f"chunk_{chunk_count}.mp3")
        chunk.export(path, format="mp3", bitrate="64k")
        chunk_paths.append(path)
        
        # El siguiente fragmento empieza donde terminó este
        current_start = actual_end
        chunk_count += 1
        
    return chunk_paths
