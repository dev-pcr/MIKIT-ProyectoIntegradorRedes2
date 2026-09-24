import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Upload, FileText, MessageSquareText, Key, Check, Copy, Save, Download, X, Loader2, AlertCircle, ChevronRight, ChevronLeft, Plus, Film } from 'lucide-react'
import { processTextStream, saveToDesktop } from '../utils/api'
import { getTranscriptions, addTranscription, getTextApiKeys, getActiveTextApiKey, getPromptTemplates, savePromptTemplates } from '../utils/preferences'
import { getAllKaraokes } from '../utils/storage'

const maskKey = (keyString) => {
  if (keyString.length <= 8) return '********';
  return `${keyString.slice(0, 4)}...${keyString.slice(-4)}`;
}

// Toma "solo el nombre del archivo y el cuerpo limpio": quita frontmatter (---...---)
const parseMarkdownSource = (fileName, rawText) => {
  const name = fileName.replace(/\.md$/i, '').replace(/\.markdown$/i, '').trim()
  let body = rawText.trim()
  if (body.startsWith('---')) {
    const end = body.indexOf('\n---', 3)
    if (end !== -1) body = body.slice(end + 4).trim()
  }
  return { name, content: body }
}

const STEPS = [
  { id: 1, label: 'Fuentes' },
  { id: 2, label: 'Prompt y Clave' },
  { id: 3, label: 'Resultado' },
]

export default function AIProcessor() {
  const [transcriptions, setTranscriptions] = useState([])
  const [karaokes, setKaraokes] = useState([])
  const [promptTemplates, setPromptTemplates] = useState([])
  const [textKeys, setTextKeys] = useState([])

  const [step, setStep] = useState(1)

  // Fuentes seleccionadas
  const [selectedInternal, setSelectedInternal] = useState([])   // ids de fuentes internas
  const [externalFiles, setExternalFiles] = useState([])         // { id, name, content }
  const [dragging, setDragging] = useState(false)

  // Config
  const [selectedPromptId, setSelectedPromptId] = useState('')
  const [selectedKeyId, setSelectedKeyId] = useState('')

  // Nuevo prompt modal
  const [newPromptModal, setNewPromptModal] = useState(false)
  const [newPromptName, setNewPromptName] = useState('')
  const [newPromptText, setNewPromptText] = useState('')

  // Procesado
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState('')
  const [resultName, setResultName] = useState('')
  const [error, setError] = useState('')

  // Toasts
  const [toasts, setToasts] = useState([])
  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])

  const fileInputRef = useRef(null)
  const MAX_SOURCES = 2
  const totalSources = selectedInternal.length + externalFiles.length

  const loadData = useCallback(async () => {
    setTranscriptions(getTranscriptions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    setPromptTemplates(getPromptTemplates())
    setTextKeys(getTextApiKeys())
    try {
      const ks = await getAllKaraokes()
      setKaraokes(ks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    } catch (e) {
      console.error('Error cargando karaokes', e)
      setKaraokes([])
    }
  }, [])

  useEffect(() => {
    loadData()
    const keys = getTextApiKeys()
    if (keys.length > 0) {
      const active = keys.find(k => k.active) || keys[0]
      setSelectedKeyId(active.id)
    }
  }, [loadData])

  // --- Selección de fuentes ---
  const toggleInternal = (id) => {
    if (selectedInternal.includes(id)) {
      setSelectedInternal(prev => prev.filter(x => x !== id))
      return
    }
    if (totalSources >= MAX_SOURCES) {
      addToast(`Máximo ${MAX_SOURCES} fuentes por procesamiento`, 'error')
      return
    }
    setSelectedInternal(prev => [...prev, id])
  }

  const removeExternal = (id) => {
    setExternalFiles(prev => prev.filter(f => f.id !== id))
  }

  const addExternalFiles = (fileList) => {
    if (!fileList || fileList.length === 0) return
    const mdFiles = Array.from(fileList).filter(f => /\.(md|markdown)$/i.test(f.name))
    if (mdFiles.length === 0) {
      addToast('Solo se aceptan archivos .md o .markdown', 'error')
      return
    }
    let remaining = MAX_SOURCES - totalSources
    if (remaining <= 0) {
      addToast(`Máximo ${MAX_SOURCES} fuentes por procesamiento`, 'error')
      return
    }
    const toAdd = mdFiles.slice(0, remaining)
    Promise.all(toAdd.map(file => file.text().then(raw => ({
      id: `${Date.now()}-${file.name}`,
      ...parseMarkdownSource(file.name, raw)
    })))).then(parsed => {
      setExternalFiles(prev => [...prev, ...parsed])
      if (mdFiles.length > remaining) {
        addToast(`Máximo ${MAX_SOURCES} fuentes. Se agregaron ${remaining}.`)
      }
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    addExternalFiles(e.dataTransfer.files)
  }

  const internalSources = [
    ...transcriptions.map(t => ({ ...t, kind: 'text' })),
    ...karaokes.map(k => ({ ...k, kind: 'karaoke' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const selectedTranscriptions = selectedInternal
    .map(id => internalSources.find(t => t.id === id))
    .filter(Boolean)

  const selectedPrompt = promptTemplates.find(p => p.id === selectedPromptId)
  const selectedKey = textKeys.find(k => k.id === selectedKeyId)

  // --- Nuevo prompt ---
  const handleSaveNewPrompt = () => {
    const name = newPromptName.trim()
    const text = newPromptText.trim()
    if (!name) {
      addToast('Poné un nombre para el prompt', 'error')
      return
    }
    if (!text) {
      addToast('Escribí el texto del prompt', 'error')
      return
    }
    const current = getPromptTemplates()
    const newPrompt = { id: Date.now().toString(), name, text }
    const updated = [...current, newPrompt]
    savePromptTemplates(updated)
    setPromptTemplates(updated)
    setSelectedPromptId(newPrompt.id)
    setNewPromptModal(false)
    setNewPromptName('')
    setNewPromptText('')
    addToast('Prompt guardado en tus plantillas')
  }

  // --- Procesado ---
  const handleProcess = async () => {
    setError('')
    setResult('')

    if (totalSources === 0) {
      addToast('Seleccioná al menos una fuente para procesar', 'error')
      return
    }
    if (!selectedPrompt) {
      addToast('Seleccioná una plantilla de prompt', 'error')
      return
    }
    if (!selectedKey) {
      addToast('Seleccioná una clave de texto (OpenRouter)', 'error')
      return
    }

    const texts = [
      ...selectedTranscriptions.map(t => ({ name: t.name, content: t.text })),
      ...externalFiles.map(f => ({ name: f.name, content: f.content })),
    ]
    const baseName = resultName.trim() || `Procesado IA - ${new Date().toLocaleString('es-AR')}`
    setResultName(baseName)

    // Avanzar al paso 3 YA: muestra spinner y luego el streaming en vivo
    setStep(3)
    setIsProcessing(true)
    try {
      let acc = ''
      await processTextStream(selectedKey.key, selectedPrompt.text, texts, (event) => {
        if (event.status === 'chunk') {
          acc += event.text
          setResult(acc)
        } else if (event.status === 'error') {
          setError(event.detail || 'Error al procesar')
        }
      })
      if (!acc) setError('No se recibió respuesta del modelo.')
    } catch (e) {
      setError(e.message || 'Error al procesar el texto')
    } finally {
      setIsProcessing(false)
    }
  }

  const canContinueFromSources = totalSources > 0

  const goNext = () => {
    if (step === 1 && !canContinueFromSources) {
      addToast('Seleccioná al menos una fuente para continuar', 'error')
      return
    }
    if (step === 2 && (!selectedPrompt || !selectedKey)) {
      addToast('Seleccioná prompt y clave para continuar', 'error')
      return
    }
    setStep(s => Math.min(s + 1, 3))
  }

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      addToast('Copiado al portapapeles')
    } catch {
      addToast('No se pudo copiar', 'error')
    }
  }

  const handleSaveHistory = () => {
    if (!result) return
    addTranscription({
      name: resultName.trim() || 'Procesado con IA',
      text: result,
      folder: null,
    })
    addToast('Guardado en Historial')
  }

  const handleDownload = async () => {
    if (!result) return
    try {
      await saveToDesktop(resultName.trim() || 'Procesado con IA', result)
      addToast('Descargado en el Escritorio')
    } catch (e) {
      addToast(e.message || 'Error al descargar', 'error')
    }
  }

  return (
    <div className="space-y-8">
      {/* Toasts */}
      <div className="fixed top-6 right-6 z-[120] space-y-3">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 40 }}
              className={`glass-card px-4 py-3 shadow-xl flex items-center gap-3 ${toast.type === 'error' ? 'border-red-500/30' : 'border-brand-500/30'}`}
            >
              {toast.type === 'error' ? <AlertCircle size={16} className="text-red-500" /> : <Check size={16} className="text-brand-500" />}
              <span className="text-sm font-medium text-white">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div>
        <h2 className="text-3xl font-display font-bold text-white flex items-center gap-3">
          <Sparkles className="text-brand-500" /> Procesar con IA
        </h2>
        <p className="text-sm text-zinc-500 mt-1">Tres pasos: elegí las fuentes, definí el prompt y la clave, y obtené tu resultado en Markdown.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2 flex-1">
            <button
              onClick={() => { if (s.id < step) setStep(s.id) }}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl glass transition-all flex-1 text-left ${
                step === s.id ? 'border-brand-500/40 bg-brand-500/10' : s.id < step ? 'hover:bg-white/5 cursor-pointer' : 'opacity-50 cursor-default'
              }`}
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                s.id < step ? 'bg-green-500/20 text-green-400' : step === s.id ? 'bg-brand-500 text-white' : 'bg-white/10 text-zinc-500'
              }`}>
                {s.id < step ? <Check size={14} /> : s.id}
              </div>
              <span className={`text-sm font-medium whitespace-nowrap ${step === s.id ? 'text-white' : 'text-zinc-500'}`}>{s.label}</span>
            </button>
            {i < STEPS.length - 1 ? <ChevronRight size={16} className="text-zinc-700 flex-shrink-0" /> : null}
          </div>
        ))}
      </div>

      {/* STEP 1: Fuentes */}
      {step === 1 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 space-y-6">
          <div className="flex items-center gap-3 text-white">
            <Upload className="text-brand-500" />
            <div>
              <h3 className="text-xl font-bold">Fuentes ({totalSources}/{MAX_SOURCES})</h3>
              <p className="text-xs text-zinc-500">Arrastrá archivos .md o seleccioná transcripciones. Hasta {MAX_SOURCES} fuentes por procesamiento.</p>
            </div>
          </div>

          {/* Dropzone PRIMERO */}
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Archivos .md</p>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all flex flex-col items-center gap-2 ${
                dragging ? 'border-brand-500 bg-brand-500/10' : 'border-white/15 hover:border-brand-500/50 hover:bg-white/5'
              }`}
            >
              <Upload size={28} className={dragging ? 'text-brand-500' : 'text-zinc-500'} />
              <p className="text-sm text-zinc-400 font-medium">Arrastrá tus archivos .md acá</p>
              <p className="text-xs text-zinc-600">o hacé clic para seleccionarlos</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".md,.markdown"
              multiple
              className="hidden"
              onChange={(e) => { addExternalFiles(e.target.files); e.target.value = '' }}
            />
          </div>

          {/* Fuentes externas agregadas */}
          {externalFiles.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Archivos seleccionados</p>
              {externalFiles.map(f => (
                <div key={f.id} className="flex items-center gap-3 p-3 rounded-xl bg-brand-500/10 border border-brand-500/40">
                  <FileText size={16} className="text-brand-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-white truncate">{f.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{f.content.slice(0, 60)}…</p>
                  </div>
                  <button onClick={() => removeExternal(f.id)} className="p-1.5 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all">
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {/* Transcripciones y karaokes ABAJO */}
          <div>
            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Transcripciones y karaokes del historial</p>
            {internalSources.length > 0 ? (
              <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                {internalSources.map(t => {
                  const checked = selectedInternal.includes(t.id)
                  return (
                    <button
                      key={`${t.kind}-${t.id}`}
                      onClick={() => toggleInternal(t.id)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${
                        checked
                          ? 'bg-brand-500/10 border-brand-500/40'
                          : 'bg-white/5 border-white/10 hover:bg-white/10'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 transition-all ${checked ? 'bg-brand-500 border-brand-500' : 'border-zinc-600'}`}>
                        {checked ? <Check size={14} className="text-white" /> : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          {t.kind === 'karaoke' ? (
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold uppercase flex items-center gap-1 flex-shrink-0">
                              <Film size={10} /> Karaoke
                            </span>
                          ) : null}
                          <p className={`text-sm font-medium truncate ${checked ? 'text-white' : 'text-zinc-300'}`}>{t.name}</p>
                        </div>
                        <p className="text-xs text-zinc-500 truncate">{t.text?.slice(0, 60)}…</p>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="text-sm text-zinc-500 text-center py-4 bg-white/5 rounded-xl">
                No hay transcripciones ni karaokes guardados todavía.
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button onClick={goNext} disabled={!canContinueFromSources} className="btn-primary px-6 py-3 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              Continuar <ChevronRight size={18} />
            </button>
          </div>
        </motion.div>
      ) : null}

      {/* STEP 2: Prompt y Clave */}
      {step === 2 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 space-y-6">
          <div className="flex items-center gap-3 text-white">
            <MessageSquareText className="text-brand-500" />
            <div>
              <h3 className="text-xl font-bold">Prompt y Clave</h3>
              <p className="text-xs text-zinc-500">Elegí qué instrucciones darle a la IA y con qué clave se procesa.</p>
            </div>
          </div>

          {/* Resumen de fuentes */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-wrap items-center gap-2">
            <span className="text-xs text-zinc-500 font-medium mr-1">Fuentes:</span>
            {selectedTranscriptions.map(t => (
              <span key={t.id} className="text-xs px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30 flex items-center gap-1.5">
                {t.kind === 'karaoke' ? <Film size={11} /> : <FileText size={11} />} {t.name}
              </span>
            ))}
            {externalFiles.map(f => (
              <span key={f.id} className="text-xs px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30 flex items-center gap-1.5">
                <FileText size={11} /> {f.name}
              </span>
            ))}
          </div>

          {/* Prompt */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-white">Plantilla de prompt</p>
              <button
                onClick={() => setNewPromptModal(true)}
                className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1.5 font-medium transition-colors"
              >
                <Plus size={14} /> Nuevo prompt
              </button>
            </div>
            {promptTemplates.length > 0 ? (
              <>
                <select
                  value={selectedPromptId}
                  onChange={(e) => setSelectedPromptId(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                >
                  <option value="" className="bg-zinc-900">Seleccioná una plantilla…</option>
                  {promptTemplates.map(p => (
                    <option key={p.id} value={p.id} className="bg-zinc-900">{p.name}</option>
                  ))}
                </select>
                {selectedPrompt ? (
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                    <p className="text-xs font-semibold text-brand-400 mb-1">{selectedPrompt.name}</p>
                    <p className="text-xs text-zinc-400 whitespace-pre-wrap line-clamp-4 break-words">{selectedPrompt.text}</p>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-zinc-500">
                No hay plantillas de prompts. <button onClick={() => setNewPromptModal(true)} className="text-brand-400 hover:text-brand-300 font-medium">Creá una ahora</button>.
              </p>
            )}
          </div>

          {/* Clave */}
          <div className="space-y-3">
            <p className="text-sm font-semibold text-white">Clave API (OpenRouter)</p>
            {textKeys.length > 0 ? (
              <select
                value={selectedKeyId}
                onChange={(e) => setSelectedKeyId(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors"
              >
                {textKeys.map(k => (
                  <option key={k.id} value={k.id} className="bg-zinc-900">
                    {k.alias} · {k.active ? 'Activa' : 'Inactiva'} · {maskKey(k.key)}
                  </option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-zinc-500">
                No hay claves de texto. Agregá una en <span className="text-zinc-300">Configuración → Claves API para procesado de texto</span>.
              </p>
            )}
          </div>

          <div className="flex justify-between pt-2">
            <button onClick={() => setStep(1)} className="btn-secondary px-5 py-3 flex items-center gap-2">
              <ChevronLeft size={18} /> Volver
            </button>
            <button onClick={handleProcess} disabled={isProcessing || !selectedPrompt || !selectedKey} className="btn-primary px-6 py-3 flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
              {isProcessing ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
              {isProcessing ? 'Procesando…' : 'Procesar'} <ChevronRight size={18} />
            </button>
          </div>
        </motion.div>
      ) : null}

      {/* STEP 3: Resultado */}
      {step === 3 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 space-y-5">
          <div className="flex items-center gap-3 text-white">
            <Sparkles className="text-brand-500" />
            <div>
              <h3 className="text-xl font-bold">Resultado</h3>
              <p className="text-xs text-zinc-500">El modelo responde únicamente en Markdown.</p>
            </div>
          </div>

          <input
            type="text"
            value={resultName}
            onChange={(e) => setResultName(e.target.value)}
            placeholder="Nombre del resultado (ej. Resumen de clase)"
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors"
          />

          {error ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-300">{error}</p>
            </div>
          ) : null}

          {result || isProcessing ? (
            <div className="flex-1 bg-black/30 border border-white/10 rounded-2xl p-5 min-h-[300px] max-h-[460px] overflow-y-auto">
              {result ? (
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-wrap">{result}</p>
              ) : (
                <div className="flex flex-col items-center justify-center h-full min-h-[260px] text-zinc-600 gap-4">
                  <Loader2 size={36} className="animate-spin text-brand-500" />
                  <p className="text-sm font-medium text-zinc-400">Procesando con OpenRouter…</p>
                  <p className="text-xs text-zinc-600">El modelo se elige automáticamente según el contenido.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 bg-black/30 border border-white/10 rounded-2xl p-5 min-h-[300px] flex items-center justify-center text-center">
              <div className="space-y-2">
                <Sparkles size={32} className="text-zinc-700 mx-auto" />
                <p className="text-sm text-zinc-500">Apretá <span className="text-zinc-300">Procesar</span> en el paso anterior<br />y el resultado aparecerá acá.</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3 items-center">
            <button onClick={() => setStep(2)} className="btn-secondary px-5 py-2.5 flex items-center gap-2 text-sm">
              <ChevronLeft size={16} /> Ajustar
            </button>
            {result ? (
              <>
                <button onClick={() => handleCopy(result)} className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-2 text-sm">
                  <Copy size={16} /> Copiar
                </button>
                <button onClick={handleSaveHistory} className="btn-secondary flex-1 py-2.5 flex items-center justify-center gap-2 text-sm">
                  <Save size={16} /> Guardar en Historial
                </button>
                <button onClick={handleDownload} className="btn-primary py-2.5 px-4 flex items-center justify-center gap-2 text-sm">
                  <Download size={16} /> .md
                </button>
              </>
            ) : null}
          </div>
        </motion.div>
      ) : null}

      {/* Nuevo prompt modal */}
      <AnimatePresence>
        {newPromptModal ? (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 w-full max-w-3xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">Nueva Plantilla de Prompt</h3>
                <button onClick={() => setNewPromptModal(false)} className="p-2 hover:bg-white/5 text-zinc-500 hover:text-white rounded-lg transition-all">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">Nombre</label>
                <input
                  type="text"
                  value={newPromptName}
                  onChange={(e) => setNewPromptName(e.target.value)}
                  placeholder="Ej. Resumir clase"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">Texto del prompt</label>
                <textarea
                  value={newPromptText}
                  onChange={(e) => setNewPromptText(e.target.value)}
                  rows={8}
                  placeholder="Ej: Resumí el texto en 5 bullets con las ideas principales…"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors resize-y min-h-[200px] font-mono"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setNewPromptModal(false)} className="btn-secondary flex-1 py-2.5">Cancelar</button>
                <button onClick={handleSaveNewPrompt} className="btn-primary flex-[2] py-2.5 flex items-center justify-center gap-2">
                  <Plus size={16} /> Guardar y usar
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}