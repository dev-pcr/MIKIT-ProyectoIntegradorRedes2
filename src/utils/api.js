const API_BASE_URL = 'http://127.0.0.1:8000';

export async function transcribeAudioStream(file, apiKey, onProgress) {
  const formData = new FormData();
  formData.append('file', file);
  if (apiKey) {
    formData.append('api_key', apiKey);
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

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split('\n');

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
}

export async function checkBackendStatus() {
  try {
    const response = await fetch(`${API_BASE_URL}/`);
    return response.ok;
  } catch (error) {
    return false;
  }
}

export const saveToDesktop = async (title, content) => {
  const response = await fetch(`${API_BASE_URL}/save_md`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ title, content }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Error al guardar en el escritorio');
  }
  
  return await response.json();
};

export const saveAudioToDesktop = async (blob, title) => {
  const formData = new FormData();
  formData.append('file', blob);
  formData.append('title', title);
  
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
