const KEYS_STORAGE = 'groq_api_keys';
const TEXT_KEYS_STORAGE = 'groq_text_api_keys';
const TEMPLATES_STORAGE = 'name_templates';
const PROMPT_TEMPLATES_STORAGE = 'prompt_templates';
const TRANSCRIPTIONS_STORAGE = 'transcriptions_history';
const NOISE_GATE_STORAGE = 'noise_gate_settings';

// --- API Keys ---
export function getApiKeys() {
  const keys = localStorage.getItem(KEYS_STORAGE);
  return keys ? JSON.parse(keys) : [];
}

export function saveApiKeys(keys) {
  localStorage.setItem(KEYS_STORAGE, JSON.stringify(keys));
}

export function getActiveApiKey() {
  const keys = getApiKeys();
  const active = keys.find(k => k.active);
  return active ? active.key : null;
}

// --- API Keys (texto) ---
export function getTextApiKeys() {
  const keys = localStorage.getItem(TEXT_KEYS_STORAGE);
  return keys ? JSON.parse(keys) : [];
}

export function saveTextApiKeys(keys) {
  localStorage.setItem(TEXT_KEYS_STORAGE, JSON.stringify(keys));
}

export function getActiveTextApiKey() {
  const keys = getTextApiKeys();
  const active = keys.find(k => k.active);
  return active ? active.key : null;
}

// --- Templates ---
export function getTemplates() {
  const templates = localStorage.getItem(TEMPLATES_STORAGE);
  return templates ? JSON.parse(templates) : [
    'Ingeniería de Software',
    'Redes 2',
    'Entrevista',
    'Notas Personales'
  ];
}

export function saveTemplates(templates) {
  localStorage.setItem(TEMPLATES_STORAGE, JSON.stringify(templates));
}

// --- Prompt Templates ---
export function getPromptTemplates() {
  const data = localStorage.getItem(PROMPT_TEMPLATES_STORAGE);
  return data ? JSON.parse(data) : [];
}

export function savePromptTemplates(templates) {
  localStorage.setItem(PROMPT_TEMPLATES_STORAGE, JSON.stringify(templates));
}

// --- Transcriptions ---
export function getTranscriptions() {
  const data = localStorage.getItem(TRANSCRIPTIONS_STORAGE);
  return data ? JSON.parse(data) : [];
}

export function saveTranscriptions(transcriptions) {
  localStorage.setItem(TRANSCRIPTIONS_STORAGE, JSON.stringify(transcriptions));
}

export function addTranscription(transcription) {
  const all = getTranscriptions();
  all.push({
    id: Date.now().toString(),
    createdAt: new Date().toISOString(),
    ...transcription
  });
  saveTranscriptions(all);
}

export function deleteTranscription(id) {
  const all = getTranscriptions();
  const filtered = all.filter(t => t.id !== id);
  saveTranscriptions(filtered);
}

export function updateTranscription(id, updates) {
  const all = getTranscriptions();
  const idx = all.findIndex(t => t.id === id);
  if (idx !== -1) {
    all[idx] = { ...all[idx], ...updates };
    saveTranscriptions(all);
  }
}

// --- Noise gate (puerta de ruido) ---
// El umbral se guarda en dBFS y arranca en `null` = "sin configurar".
// Ese `null` es lo que mantiene bloqueado el botón de grabación: no tiene
// sentido dar por buena una puerta que el usuario nunca calibró.
export const NOISE_GATE_MIN_DB = -60;
export const NOISE_GATE_MAX_DB = 0;

export function getNoiseGateSettings() {
  try {
    const raw = localStorage.getItem(NOISE_GATE_STORAGE);
    if (!raw) return { thresholdDb: null, enabled: true };
    const parsed = JSON.parse(raw);
    return {
      thresholdDb: typeof parsed.thresholdDb === 'number' ? parsed.thresholdDb : null,
      enabled: parsed.enabled !== false,
    };
  } catch {
    return { thresholdDb: null, enabled: true };
  }
}

export function saveNoiseGateSettings(settings) {
  localStorage.setItem(NOISE_GATE_STORAGE, JSON.stringify(settings));
}

export function clearNoiseGateSettings() {
  localStorage.removeItem(NOISE_GATE_STORAGE);
}
