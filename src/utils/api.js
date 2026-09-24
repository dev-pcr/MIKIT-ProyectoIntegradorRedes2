// Base relativa: en produccion local el backend sirve el frontend desde el mismo origen.
// En dev (Vite en 5173) se puede overridear con VITE_API_BASE=http://127.0.0.1:8000
const API_BASE_URL = import.meta.env.VITE_API_BASE || '';

export async function transcribeAudioStream(file, apiKeys, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  
  if (Array.isArray(apiKeys) && apiKeys.length > 0) {
    // Enviamos el pool completo como JSON string
    formData.append('api_keys', JSON.stringify(apiKeys));
    // También enviamos la activa por compatibilidad si es necesario
    const active = apiKeys.find(k => k.active);
    if (active) formData.append('api_key', active.key);
  }

  const response = await fetch(`${API_BASE_URL}/transcribe`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Error en la transcripción' }));
    throw new Error(error.detail || 'Error en la transcripción');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let lineBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    lineBuffer += decoder.decode(value, { stream: true });
    const lines = lineBuffer.split('\n');
    
    // El último elemento de 'lines' podría estar incompleto (sin el \n final)
    // así que lo guardamos en el buffer para la siguiente lectura.
    lineBuffer = lines.pop();

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          const data = JSON.parse(line.substring(6));
          if (onProgress) onProgress(data);
        } catch (e) {
          console.error("Error parsing stream data", e);
        }
      }
    }
  }

  // Procesar cualquier línea remanente al finalizar
  if (lineBuffer.startsWith('data: ')) {
    try {
      const data = JSON.parse(lineBuffer.substring(6));
      if (onProgress) onProgress(data);
    } catch (e) {
      console.error("Error parsing final stream data", e);
    }
  }
}

export async function checkBackendStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export const saveToDesktop = async (title, content, folderName = null) => {
  const response = await fetch(`${API_BASE_URL}/save_md`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, content, folder: folderName }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al guardar en el escritorio');
  }
  
  return await response.json();
};

export const saveAudioToDesktop = async (blob, title, folderName = null) => {
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('title', title);
  if (folderName) formData.append('folder', folderName);
  
  const response = await fetch(`${API_BASE_URL}/save_audio`, {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al guardar el audio en el escritorio');
  }
  
  return await response.json();
};
