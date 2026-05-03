const KEYS_STORAGE = 'groq_api_keys';
const TEMPLATES_STORAGE = 'name_templates';
const TRANSCRIPTIONS_STORAGE = 'transcriptions_history';

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
