import { useState, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Upload, FileAudio, X, Copy, Download, Save, Loader2, AlertCircle, Trash2, ChevronRight, FileText, Check, CheckCircle2, Circle, CircleAlert, CircleDotDashed, CircleX, FolderDown } from 'lucide-react'
import { transcribeAudioStream, saveToDesktop } from '../utils/api'
import { getActiveApiKey, getApiKeys, getTranscriptions, addTranscription, deleteTranscription } from '../utils/preferences'
import { useLocation } from 'react-router-dom'

export default function Transcriber() {
  const location = useLocation()
  const [file, setFile] = useState(location.state?.audioBlob || null)
  const [fileName, setFileName] = useState(location.state?.fileName || '')
  const [status, setStatus] = useState('idle') // idle, uploading, transcribing, ready
  const [result, setResult] = useState('')
  const [error, setError] = useState(null)

  // History and Saving states
  const [history, setHistory] = useState([])
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [expandedId, setExpandedId] = useState(null)

  // UI States (Alerts & Confirmations)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [toasts, setToasts] = useState([])

  // Mass export state
  const [isExporting, setIsExporting] = useState(false)

  // Progress UI States
  const [tasks, setTasks] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState(["1", "2", "3"]);
  const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks((prev) => prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]);
  };

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = () => {
    setHistory(getTranscriptions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  }

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  const handleFileDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile) {
      setFile(droppedFile)
      setFileName(droppedFile.name)
    }
  }

  const handleMassExport = async () => {
    const items = getTranscriptions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    if (items.length === 0) {
      addToast('No hay transcripciones para exportar', 'error')
      return
    }
    setIsExporting(true)
    const folderName = `MIKIT_Transcripciones_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 5).replace(':', '')}`
    addToast(`Iniciando exportación de ${items.length} transcripciones...`, 'success')

    let done = 0
    for (const item of items) {
      try {
        addToast(`Procesando ${done + 1} de ${items.length}: ${item.name}`, 'success')
        const dateStr = new Date(item.createdAt).toLocaleString('es-AR')
        const mdContent = `# Transcripción: ${item.name}\n**Fecha:** ${dateStr}\n\n---\n\n${item.text}`
        await saveToDesktop(item.name, mdContent, folderName)
        done++
      } catch (err) {
        addToast(`Exportación detenida en ${done}/${items.length}. Error en "${item.name}": ${err.message}`, 'error')
        setIsExporting(false)
        return
      }
    }
    addToast(`✅ ${done} transcripciones exportadas en carpeta "${folderName}"`, 'success')
    setIsExporting(false)
  }

  const startTranscription = async () => {
    setStatus('transcribing')
    setError(null)

    // Initial Tasks Setup
    setTasks([
      { id: "1", title: "Fraccionando audio", description: "Preparando el archivo y dividiéndolo en partes para procesarlo óptimamente.", status: "pending", subtasks: [] },
      { id: "2", title: "Transcribiendo fragmentos", description: "Enviando cada parte al modelo Whisper para su transcripción.", status: "pending", subtasks: [] },
      {
        id: "3", title: "Ensamblando resultado", description: "Uniendo las transcripciones de cada fragmento en el texto final.", status: "pending", subtasks: [
          { id: "3.1", title: "Leyendo memoria temporal", status: "pending" },
          { id: "3.2", title: "Normalizando texto", status: "pending" },
          { id: "3.3", title: "Preparando respuesta final", status: "pending" }
        ]
      }
    ]);
    setExpandedTasks(["1", "2", "3"]);

    try {
      const allKeys = getApiKeys()
      if (allKeys.length === 0) {
        throw new Error('No hay API Keys configuradas. Por favor, agrega al menos una en la pestaña de Configuración.')
      }

      const fileToUpload = file instanceof File ? file : new File([file], fileName || 'audio.wav', { type: file.type || 'audio/wav' })

      await transcribeAudioStream(fileToUpload, allKeys, (event) => {
        setTasks(prev => prev.map(t => {
          if (event.status === 'splitting' && t.id === "1") return { ...t, status: "in-progress" };
          if (event.status === 'transcribing') {
            if (t.id === "1") return { ...t, status: "completed" };
            if (t.id === "2") {
              const subtasks = Array.from({ length: event.total }).map((_, i) => ({
                id: `2.${i + 1}`,
                title: `Transcribir fragmento ${i + 1}`,
                status: "pending"
              }));
              return { ...t, status: "in-progress", subtasks };
            }
          }
          if (event.status === 'transcribing_chunk' && t.id === "2") {
            const subtasks = t.subtasks.map(s => {
              const num = parseInt(s.id.split('.')[1]);
              if (num < event.chunk) return { ...s, status: "completed" };
              if (num === event.chunk) return { ...s, status: "in-progress" };
              return s;
            });
            return { ...t, subtasks, description: `Procesando con clave: ${event.key_alias || '...'}` };
          }
          if (event.status === 'rotating_key' && t.id === "2") {
            return { ...t, description: `🔄 ${event.message}` };
          }
          if (event.status === 'waiting_limit' && t.id === "2") {
            return { ...t, description: `⏳ ${event.message}` };
          }
          if (event.status === 'retrying' && t.id === "2") {
            return { ...t, description: `⚠️ ${event.message}` };
          }
          if (event.status === 'joining' || event.status === 'joining_buffer') {
            if (t.id === "2") {
              return { ...t, status: "completed", subtasks: t.subtasks.map(s => ({ ...s, status: "completed" })) };
            }
            if (t.id === "3") {
              return {
                ...t,
                status: "in-progress",
                subtasks: t.subtasks.map(s => s.id === "3.1" ? { ...s, status: "in-progress" } : s)
              };
            }
          }
          if (event.status === 'joining_processing' && t.id === "3") {
            return {
              ...t,
              subtasks: t.subtasks.map(s => {
                if (s.id === "3.1") return { ...s, status: "completed" };
                if (s.id === "3.2") return { ...s, status: "in-progress" };
                return s;
              })
            };
          }
          if (event.status === 'joining_finalizing' && t.id === "3") {
            return {
              ...t,
              subtasks: t.subtasks.map(s => {
                if (s.id === "3.1" || s.id === "3.2") return { ...s, status: "completed" };
                if (s.id === "3.3") return { ...s, status: "in-progress" };
                return s;
              })
            };
          }
          if (event.status === 'completed') {
            if (t.id === "3") return { ...t, status: "completed", subtasks: t.subtasks.map(s => ({ ...s, status: "completed" })) };
          }
          if (event.status === 'error') {
            if (t.status === "in-progress") return { ...t, status: "failed" };
          }
          return t;
        }));

        if (event.status === 'completed') {
          setResult(event.text);
          setSaveName(fileName || 'Transcripción Nueva');
          setStatus('ready');
          addToast('Transcripción completada con éxito', 'success');
        } else if (event.status === 'error') {
          setError(event.detail || event.message);
          setStatus('idle');
          addToast('Error al transcribir', 'error');
        }
      });

    } catch (err) {
      console.error(err)
      setError(err.message)
      setStatus('idle')
      addToast('Error al transcribir', 'error')
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    addToast('Texto copiado al portapapeles', 'success')
  }

  const handleSaveToDesktop = async (title, text) => {
    try {
      await saveToDesktop(title, text)
      addToast('Archivo guardado en el Escritorio', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const handleSaveToHistory = () => {
    addTranscription({
      name: saveName,
      text: result
    })
    setIsSaveModalOpen(false)
    loadHistory()
    addToast('Transcripción guardada en el historial', 'success')
  }

  const confirmDelete = (item) => {
    setItemToDelete(item)
    setDeleteModalOpen(true)
  }

  const executeDelete = () => {
    if (!itemToDelete) return
    deleteTranscription(itemToDelete.id)
    loadHistory()
    setDeleteModalOpen(false)
    setItemToDelete(null)
    addToast('Transcripción eliminada', 'error')
  }

  const taskVariants = {
    hidden: { opacity: 0, y: prefersReducedMotion ? 0 : -5 },
    visible: { opacity: 1, y: 0, transition: { type: prefersReducedMotion ? "tween" : "spring", stiffness: 500, damping: 30, duration: prefersReducedMotion ? 0.2 : undefined } },
    exit: { opacity: 0, y: prefersReducedMotion ? 0 : -5, transition: { duration: 0.15 } }
  };
  const subtaskListVariants = {
    hidden: { opacity: 0, height: 0, overflow: "hidden" },
    visible: { height: "auto", opacity: 1, overflow: "visible", transition: { duration: 0.25, staggerChildren: prefersReducedMotion ? 0 : 0.05, when: "beforeChildren", ease: [0.2, 0.65, 0.3, 0.9] } },
    exit: { height: 0, opacity: 0, overflow: "hidden", transition: { duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] } }
  };
  const subtaskVariants = {
    hidden: { opacity: 0, x: prefersReducedMotion ? 0 : -10 },
    visible: { opacity: 1, x: 0, transition: { type: prefersReducedMotion ? "tween" : "spring", stiffness: 500, damping: 25, duration: prefersReducedMotion ? 0.2 : undefined } },
    exit: { opacity: 0, x: prefersReducedMotion ? 0 : -10, transition: { duration: 0.15 } }
  };
  const statusBadgeVariants = {
    initial: { scale: 1 },
    animate: { scale: prefersReducedMotion ? 1 : [1, 1.08, 1], transition: { duration: 0.35, ease: [0.34, 1.56, 0.64, 1] } }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12 relative">
      <header className="space-y-2">
        <h2 className="text-3xl font-display font-bold text-white">Transcriptor IA</h2>
        <p className="text-zinc-500">Sube tus archivos de audio o video para obtener una transcripción instantánea.</p>
      </header>

      {/* Toasts */}
      <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-3 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: 20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.9 }}
              className={`glass-card px-4 py-3 shadow-xl flex items-center gap-3 ${toast.type === 'error' ? 'border-red-500/30' : 'border-brand-500/30'}`}
            >
              {toast.type === 'error' ? <Trash2 size={16} className="text-red-500" /> : <Check size={16} className="text-brand-500" />}
              <span className="text-sm font-medium text-white">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 w-full max-w-sm space-y-6 border-red-500/20"
            >
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mx-auto">
                <AlertCircle size={24} />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-bold text-white">Eliminar Transcripción</h3>
                <p className="text-sm text-zinc-400">¿Estás seguro de que quieres eliminar <span className="text-white font-medium">"{itemToDelete?.name}"</span>?</p>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setDeleteModalOpen(false); setItemToDelete(null); }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button onClick={executeDelete} className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-xl transition-all flex-1">
                  Eliminar
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Save Modal */}
      <AnimatePresence>
        {isSaveModalOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="glass-card p-8 w-full max-w-md space-y-6"
            >
              <h3 className="text-2xl font-bold text-white">Guardar en Historial</h3>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Nombre de la transcripción</label>
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                  autoFocus
                />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsSaveModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                <button onClick={handleSaveToHistory} className="btn-primary flex-1">Guardar</button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {status === 'idle' && !file ? (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            className="border-2 border-dashed border-white/10 rounded-3xl p-16 flex flex-col items-center justify-center gap-6 hover:border-brand-500/50 hover:bg-brand-500/5 transition-all cursor-pointer group"
          >
            <div className="w-20 h-20 rounded-full bg-brand-500/10 flex items-center justify-center text-brand-500 group-hover:scale-110 transition-transform duration-500 shadow-2xl">
              <Upload size={32} />
            </div>
            <div className="text-center space-y-2">
              <p className="text-xl font-semibold text-white">Arrastra tus archivos aquí</p>
              <p className="text-zinc-500 text-sm">MP3, MP4, WAV, M4A, OGG · Sin límite de tamaño</p>
            </div>
            <label className="btn-secondary cursor-pointer">
              Seleccionar archivo
              <input
                type="file"
                className="hidden"
                accept=".mp3,.mp4,.wav,.m4a,.webm,.ogg"
                onChange={(e) => {
                  if (e.target.files[0]) {
                    setFile(e.target.files[0])
                    setFileName(e.target.files[0].name)
                  }
                }}
              />
            </label>
          </motion.div>
        ) : status === 'idle' && file ? (
          <motion.div
            key="file-ready"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-8 flex items-center justify-between"
          >
            <div className="flex items-center gap-6">
              <div className="w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                <FileAudio size={32} />
              </div>
              <div>
                <h4 className="text-lg font-bold text-white">{fileName || file.name}</h4>
                <p className="text-sm text-zinc-500">{(file.size / (1024 * 1024)).toFixed(2)} MB • Listo para transcribir</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setFile(null)} className="p-3 hover:bg-white/5 rounded-xl text-zinc-400">
                <X size={20} />
              </button>
              <button onClick={startTranscription} className="btn-primary">
                Transcribir ahora
              </button>
            </div>
          </motion.div>
        ) : status === 'idle' && error ? (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-8 border-red-500/20 bg-red-500/5 flex flex-col items-center gap-4"
          >
            <AlertCircle className="text-red-500" size={32} />
            <div className="text-center">
              <p className="font-bold text-white">Error en la transcripción</p>
              <p className="text-sm text-red-400">{error}</p>
            </div>
            <button onClick={() => { setError(null); setFile(null); }} className="btn-secondary">
              Reintentar
            </button>
          </motion.div>
        ) : (status === 'uploading' || status === 'transcribing') ? (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="glass-card p-8 flex flex-col gap-6"
          >
            <div className="flex items-center gap-4 border-b border-white/10 pb-4">
              <Loader2 size={24} className="text-brand-500 animate-spin" />
              <div>
                <h3 className="text-xl font-bold text-white">Procesando audio</h3>
                <p className="text-sm text-zinc-400">Sigue el progreso de la transcripción en tiempo real.</p>
              </div>
            </div>

            <LayoutGroup>
              <div className="overflow-hidden">
                <ul className="space-y-2">
                  {tasks.map((task, index) => {
                    const isExpanded = expandedTasks.includes(task.id);
                    const isCompleted = task.status === "completed";

                    return (
                      <motion.li
                        key={task.id}
                        className={index !== 0 ? "mt-2 pt-2 border-t border-white/5" : ""}
                        initial="hidden"
                        animate="visible"
                        variants={taskVariants}
                      >
                        <motion.div
                          className="group flex items-center px-3 py-2 rounded-lg cursor-pointer"
                          onClick={() => toggleTaskExpansion(task.id)}
                          whileHover={{ backgroundColor: "rgba(255,255,255,0.03)", transition: { duration: 0.2 } }}
                        >
                          <div className="mr-3 flex-shrink-0">
                            <AnimatePresence mode="wait">
                              <motion.div
                                key={task.status}
                                initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
                                transition={{ duration: 0.2, ease: [0.2, 0.65, 0.3, 0.9] }}
                              >
                                {task.status === "completed" ? (
                                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                                ) : task.status === "in-progress" ? (
                                  <CircleDotDashed className="h-5 w-5 text-brand-500 animate-spin" style={{ animationDuration: '3s' }} />
                                ) : task.status === "failed" ? (
                                  <CircleX className="h-5 w-5 text-red-500" />
                                ) : (
                                  <Circle className="text-zinc-600 h-5 w-5" />
                                )}
                              </motion.div>
                            </AnimatePresence>
                          </div>

                          <div className="flex min-w-0 flex-grow items-center justify-between">
                            <div className="mr-2 flex-1">
                              <span className={`font-medium ${isCompleted ? "text-zinc-400" : "text-zinc-200"}`}>
                                {task.title}
                              </span>
                              {task.description && (
                                <p className="text-xs text-zinc-500 mt-0.5">{task.description}</p>
                              )}
                            </div>

                            <div className="flex flex-shrink-0 items-center">
                              <motion.span
                                className={`rounded px-2 py-1 text-xs font-semibold ${task.status === "completed"
                                    ? "bg-green-500/10 text-green-400"
                                    : task.status === "in-progress"
                                      ? "bg-brand-500/10 text-brand-400"
                                      : task.status === "failed"
                                        ? "bg-red-500/10 text-red-400"
                                        : "bg-white/5 text-zinc-500"
                                  }`}
                                variants={statusBadgeVariants}
                                initial="initial"
                                animate="animate"
                                key={task.status}
                              >
                                {task.status === "completed" ? "Completado" : task.status === "in-progress" ? "En progreso" : task.status === "failed" ? "Error" : "Pendiente"}
                              </motion.span>
                            </div>
                          </div>
                        </motion.div>

                        <AnimatePresence mode="wait">
                          {isExpanded && task.subtasks && task.subtasks.length > 0 && (
                            <motion.div
                              className="relative overflow-hidden"
                              variants={subtaskListVariants}
                              initial="hidden"
                              animate="visible"
                              exit="hidden"
                              layout
                            >
                              <div className="absolute top-0 bottom-0 left-[22px] border-l border-dashed border-white/10" />
                              <ul className="mt-2 mb-2 ml-4 space-y-1">
                                {task.subtasks.map((subtask) => (
                                  <motion.li
                                    key={subtask.id}
                                    className="flex items-center py-1.5 pl-6"
                                    variants={subtaskVariants}
                                    layout
                                  >
                                    <div className="mr-3 flex-shrink-0">
                                      <AnimatePresence mode="wait">
                                        <motion.div
                                          key={subtask.status}
                                          initial={{ opacity: 0, scale: 0.8 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          exit={{ opacity: 0, scale: 0.8 }}
                                          transition={{ duration: 0.2 }}
                                        >
                                          {subtask.status === "completed" ? (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                          ) : subtask.status === "in-progress" ? (
                                            <CircleDotDashed className="h-4 w-4 text-brand-500 animate-spin" style={{ animationDuration: '3s' }} />
                                          ) : subtask.status === "failed" ? (
                                            <CircleX className="h-4 w-4 text-red-500" />
                                          ) : (
                                            <Circle className="text-zinc-600 h-4 w-4" />
                                          )}
                                        </motion.div>
                                      </AnimatePresence>
                                    </div>
                                    <span className={`text-sm ${subtask.status === "completed" ? "text-zinc-500" : "text-zinc-300"}`}>
                                      {subtask.title}
                                    </span>
                                  </motion.li>
                                ))}
                              </ul>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.li>
                    );
                  })}
                </ul>
              </div>
            </LayoutGroup>
          </motion.div>
        ) : (
          <motion.div
            key="ready"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-white">Resultado</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => handleCopy(result)} className="btn-secondary px-4 py-2 text-sm"><Copy size={16} /> Copiar</button>
                <button onClick={() => handleSaveToDesktop(saveName, result)} className="btn-primary px-4 py-2 text-sm"><Save size={16} /> Guardar en Escritorio</button>
                <button onClick={() => setIsSaveModalOpen(true)} className="btn-secondary px-4 py-2 text-sm"><Download size={16} /> Historial</button>
              </div>
            </div>
            <div className="glass-card p-8 min-h-[400px] prose prose-invert max-w-none prose-brand">
              <textarea
                className="w-full min-h-[400px] bg-transparent resize-none outline-none font-sans text-zinc-300 leading-relaxed"
                value={result}
                onChange={(e) => setResult(e.target.value)}
              />
            </div>
            <button
              onClick={() => { setFile(null); setStatus('idle'); }}
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
            >
              <Upload size={16} /> Subir otro archivo
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History Panel */}
      <div className="pt-8 border-t border-white/5">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">Historial de Transcripciones</h3>
          <button
            onClick={handleMassExport}
            disabled={isExporting || history.length === 0}
            className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar todo el historial como archivos .md en una carpeta del Escritorio"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FolderDown size={16} />}
            {isExporting ? 'Exportando...' : 'Exportar Todo'}
          </button>
        </div>
        <div className="grid gap-3">
          {history.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 border border-dashed border-white/10 rounded-2xl">
              No hay transcripciones en el historial.
            </div>
          ) : (
            history.map((item) => (
              <div key={item.id} className="glass-card border-white/5 overflow-hidden transition-all duration-300 hover:border-brand-500/30">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                      <FileText size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-white">{item.name}</h4>
                      <p className="text-xs text-zinc-500">{new Date(item.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(item.text); }}
                      className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                      title="Copiar texto"
                    >
                      <Copy size={18} />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); confirmDelete(item); }}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                    <div className={`p-2 text-zinc-500 transition-transform ${expandedId === item.id ? 'rotate-90' : ''}`}>
                      <ChevronRight size={20} />
                    </div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedId === item.id ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-black/20"
                    >
                      <div className="p-6">
                        <div className="flex justify-end gap-2 mb-4">
                          <button onClick={() => handleSaveToDesktop(item.name, item.text)} className="btn-secondary px-3 py-1.5 text-xs"><Save size={14} /> Escritorio</button>
                        </div>
                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{item.text}</p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
