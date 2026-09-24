import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion'
import { Upload, FileAudio, X, Copy, Download, Save, Loader2, AlertCircle, Trash2, Check, CheckCircle2, Circle, CircleAlert, CircleDotDashed, CircleX, MicVocal, Play, Pause, RotateCcw, RotateCw, ChevronLeft, ChevronRight, FastForward, FileText } from 'lucide-react'
import { transcribeAudioStream, saveToDesktop } from '../utils/api'
import { getApiKeys, addTranscription } from '../utils/preferences'
import { saveKaraoke } from '../utils/storage'
import { useLocation } from 'react-router-dom'

const formatTime = (seconds) => {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hrs > 0 ? hrs.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

const karaokeToMarkdown = (karaoke) => {
  const dateStr = new Date(karaoke.createdAt).toLocaleString('es-AR')
  const fragmentList = karaoke.segments
    .map((s, i) => `- Fragmento ${i + 1} de ${karaoke.segments.length} — ${formatTime(s.start)} – ${formatTime(s.end)}`)
    .join('\n')
  const body = karaoke.segments.map((s) => `[${formatTime(s.start)} – ${formatTime(s.end)}] ${s.text.trim()}`).join('\n')
  return `# ${karaoke.name}\n**Fecha:** ${dateStr}\n\n${fragmentList}\n\n## Texto completo\n\n${body}\n`
}

export default function Transcriber() {
  const location = useLocation()
  const [file, setFile] = useState(location.state?.audioBlob || null)
  const [fileName, setFileName] = useState(location.state?.fileName || '')
  const [status, setStatus] = useState('idle') // idle, uploading, transcribing, ready
  const [result, setResult] = useState('')
  const [segments, setSegments] = useState([])
  const [error, setError] = useState(null)

  // Saving states
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [toasts, setToasts] = useState([])

  // Karaoke preview state (player + fragmento actual del resultado)
  const [viewMode, setViewMode] = useState('karaoke') // 'karaoke' | 'text'
  const [karaokeIndex, setKaraokeIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerTime, setPlayerTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const audioRef = useRef(null)
  const objectUrlRef = useRef(null)

  // Limpiar la URL del objeto audio al desmontar
  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    }
  }, [])

  // Progress UI States
  const [tasks, setTasks] = useState([]);
  const [expandedTasks, setExpandedTasks] = useState(["1", "2", "3"]);
  const prefersReducedMotion = typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  const toggleTaskExpansion = (taskId) => {
    setExpandedTasks((prev) => prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]);
  };

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
          setSegments(Array.isArray(event.segments) ? event.segments : []);
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
    addToast('Transcripción guardada — la encontrás en Historial', 'success')
  }

  const handleSaveAsKaraoke = async () => {
    if (!file || segments.length === 0) {
      addToast('No hay fragmentos sincronizados para guardar como karaoke. Guardá la transcripción normal.', 'error')
      return
    }
    try {
      const blob = file instanceof File ? file : new Blob([file], { type: file.type || 'audio/webm' })
      await saveKaraoke(blob, {
        name: saveName,
        text: result,
        segments,
        duration: segments.length ? segments[segments.length - 1].end : 0
      })
      setIsSaveModalOpen(false)
      addToast('Karaoke guardado — la encontrás en Historial', 'success')
    } catch (err) {
      console.error(err)
      addToast('Error al guardar el karaoke', 'error')
    }
  }

  // --- Karaoke preview player (reproduce el audio local ya transcrito) ---
  const loadPreviewAudio = () => {
    if (!file) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    if (audioRef.current) {
      audioRef.current.src = url
      audioRef.current.playbackRate = playbackRate
    }
  }

  const togglePreviewPlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      if (!audioRef.current.src && file) loadPreviewAudio()
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  const handlePreviewTimeUpdate = () => {
    if (!audioRef.current) return
    const t = audioRef.current.currentTime
    setPlayerTime(t)
    // Sincronizar el fragmento actual con la reproducción
    if (segments.length && t > segments[karaokeIndex].end && karaokeIndex < segments.length - 1) {
      setKaraokeIndex(karaokeIndex + 1)
    }
  }

  const handlePreviewEnded = () => {
    setIsPlaying(false)
  }

  const handlePreviewScrub = (e) => {
    if (!audioRef.current) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const percent = x / rect.width
    audioRef.current.currentTime = percent * audioRef.current.duration
    setPlayerTime(audioRef.current.currentTime)
  }

  const skipPreviewTime = (amount) => {
    if (!audioRef.current) return
    const newTime = audioRef.current.currentTime + amount
    audioRef.current.currentTime = Math.min(Math.max(newTime, 0), audioRef.current.duration)
    setPlayerTime(audioRef.current.currentTime)
  }

  const gotoPreviewFragment = (idx) => {
    if (!segments.length) return
    const clamped = Math.min(Math.max(idx, 0), segments.length - 1)
    setKaraokeIndex(clamped)
    if (audioRef.current && isPlaying) {
      audioRef.current.currentTime = segments[clamped].start
      setPlayerTime(audioRef.current.currentTime)
    }
  }

  const changePreviewPlaybackRate = () => {
    const rates = [1, 1.5, 2, 0.5]
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
    setPlaybackRate(nextRate)
    if (audioRef.current) audioRef.current.playbackRate = nextRate
  }

  const handleExportKaraokeMd = async () => {
    try {
      const karaoke = { name: saveName, segments, createdAt: new Date().toLocaleString('es-AR') }
      await saveToDesktop(karaoke.name, karaokeToMarkdown(karaoke))
      addToast('Karaoke exportado como .md en el Escritorio', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
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

              {segments.length > 0 ? (
                <div className="space-y-3">
                  <div className="text-sm text-zinc-400">¿Cómo querés guardarlo?</div>
                  <button onClick={handleSaveToHistory} className="btn-primary flex-1 w-full flex items-center justify-center gap-2">
                    <Save size={16} /> Guardar transcripción
                  </button>
                  <button onClick={handleSaveAsKaraoke} className="btn-secondary flex-1 w-full flex items-center justify-center gap-2">
                    <MicVocal size={16} /> Guardar como Karaoke ({segments.length} fragmentos)
                  </button>
                  <button onClick={() => setIsSaveModalOpen(false)} className="w-full text-sm text-zinc-500 hover:text-white transition-colors">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setIsSaveModalOpen(false)} className="btn-secondary flex-1">Cancelar</button>
                  <button onClick={handleSaveToHistory} className="btn-primary flex-1">Guardar</button>
                </div>
              )}
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
            {/* Audio element para la reproducción del karaoke */}
            <audio
              ref={audioRef}
              onTimeUpdate={handlePreviewTimeUpdate}
              onEnded={handlePreviewEnded}
              className="hidden"
            />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <h3 className="text-xl font-bold text-white">Resultado</h3>
              <div className="flex flex-wrap items-center gap-2">
                {segments.length > 0 ? (
                  <button
                    onClick={() => setViewMode(viewMode === 'karaoke' ? 'text' : 'karaoke')}
                    className="btn-secondary px-4 py-2 text-sm"
                    title={viewMode === 'karaoke' ? 'Ver el texto completo editable' : 'Volver a la vista karaoke'}
                  >
                    {viewMode === 'karaoke' ? <FileText size={16} /> : <MicVocal size={16} />}
                    {viewMode === 'karaoke' ? 'Ver texto' : 'Ver karaoke'}
                  </button>
                ) : null}
                <button onClick={() => handleCopy(viewMode === 'karaoke' && segments.length ? segments.map(s => s.text.trim()).join(' ') : result)} className="btn-secondary px-4 py-2 text-sm"><Copy size={16} /> Copiar</button>
                <button onClick={() => handleSaveToDesktop(saveName, result)} className="btn-secondary px-4 py-2 text-sm"><Save size={16} /> Guardar en Escritorio</button>
                <button onClick={() => setIsSaveModalOpen(true)} className="btn-primary px-4 py-2 text-sm"><Download size={16} /> Guardar</button>
              </div>
            </div>

            {segments.length > 0 && viewMode === 'karaoke' ? (
              /* Vista karaoke: panel con fragmentos sincronizados */
              <div className="glass-card border-fuchsia-500/20 overflow-hidden">
                <div className="p-6 space-y-5">
                  {/* Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <MicVocal size={18} className="text-fuchsia-400" />
                      <span className="font-bold text-white">Karaoke</span>
                      <span className="text-sm text-zinc-500 font-mono">({karaokeIndex + 1}/{segments.length})</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button onClick={() => handleCopy(segments[karaokeIndex].text.trim())} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors" title="Copiar fragmento actual">
                        Copiar frag.
                      </button>
                      <button onClick={() => handleCopy(result)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors" title="Copiar todo el texto">
                        Copiar todo
                      </button>
                      <button onClick={handleExportKaraokeMd} className="px-3 py-1.5 rounded-full text-xs font-bold bg-fuchsia-500/15 text-fuchsia-300 hover:bg-fuchsia-500/25 transition-colors" title="Exportar como .md">
                        Exportar MD
                      </button>
                    </div>
                  </div>

                  {/* Fragment box */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => gotoPreviewFragment(karaokeIndex - 1)}
                      disabled={karaokeIndex === 0}
                      className="p-2 rounded-full text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Fragmento anterior"
                    >
                      <ChevronLeft size={24} />
                    </button>

                    <div className="flex-1 rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col items-center gap-3 text-center">
                      <p className="text-lg text-white font-medium leading-relaxed">{segments[karaokeIndex]?.text}</p>
                      <span className="text-sm font-mono text-fuchsia-400">{formatTime(segments[karaokeIndex]?.start)} – {formatTime(segments[karaokeIndex]?.end)}</span>
                    </div>

                    <button
                      onClick={() => gotoPreviewFragment(karaokeIndex + 1)}
                      disabled={karaokeIndex === segments.length - 1}
                      className="p-2 rounded-full text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      title="Fragmento siguiente"
                    >
                      <ChevronRight size={24} />
                    </button>
                  </div>

                  {/* Controls */}
                  <div className="flex flex-col items-center gap-3">
                    <div className="flex items-center gap-4">
                      <button onClick={() => skipPreviewTime(-10)} className="p-2 text-zinc-400 hover:text-white transition-colors" title="-10s">
                        <RotateCcw size={20} />
                      </button>
                      <button
                        onClick={togglePreviewPlay}
                        className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                        title={isPlaying ? 'Pausar' : 'Reproducir'}
                      >
                        {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
                      </button>
                      <button onClick={() => skipPreviewTime(10)} className="p-2 text-zinc-400 hover:text-white transition-colors" title="+10s">
                        <RotateCw size={20} />
                      </button>
                      <button onClick={changePreviewPlaybackRate} className="px-3 py-1.5 glass rounded-lg text-xs font-bold text-white hover:bg-white/10 transition-colors flex items-center gap-1">
                        <FastForward size={14} /> {playbackRate}x
                      </button>
                    </div>

                    <div className="w-full flex flex-col gap-2">
                      <div
                        className="h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer relative"
                        onClick={handlePreviewScrub}
                      >
                        <motion.div
                          className="absolute top-0 left-0 h-full bg-fuchsia-500"
                          style={{ width: audioRef.current?.duration ? `${(playerTime / audioRef.current.duration) * 100}%` : '0%' }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-zinc-500 font-mono">
                        <span>{formatTime(playerTime)}</span>
                        <span>{formatTime(segments[segments.length - 1].end)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass-card p-8 min-h-[400px] prose prose-invert max-w-none prose-brand">
                <textarea
                  className="w-full min-h-[400px] bg-transparent resize-none outline-none font-sans text-zinc-300 leading-relaxed"
                  value={result}
                  onChange={(e) => setResult(e.target.value)}
                />
              </div>
            )}

            <button
              onClick={() => { setFile(null); setStatus('idle'); setSegments([]); setViewMode('karaoke'); setKaraokeIndex(0); setIsPlaying(false); setPlayerTime(0); }}
              className="flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
            >
              <Upload size={16} /> Subir otro archivo
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
