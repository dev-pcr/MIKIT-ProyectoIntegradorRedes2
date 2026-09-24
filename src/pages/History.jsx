import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, FastForward, RotateCcw, RotateCw, FileText, Edit2, Check, X, Copy, Save, Trash2, AlertCircle, FolderDown, Loader2, ChevronRight, ChevronLeft, MicVocal } from 'lucide-react'
import { getAllRecordings, deleteRecording, updateRecording, getAllKaraokes, deleteKaraoke, updateKaraoke } from '../utils/storage'
import { getTranscriptions, deleteTranscription, updateTranscription } from '../utils/preferences'
import { saveAudioToDesktop, saveToDesktop } from '../utils/api'
import { useNavigate } from 'react-router-dom'

const formatTime = (seconds) => {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00'
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hrs > 0 ? hrs.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Clave única por tipo (grabaciones: id numérico; transcripciones: id string)
const itemKey = (item) => `${item.type}:${item.id}`

const karaokeToMarkdown = (karaoke) => {
  const dateStr = new Date(karaoke.createdAt).toLocaleString('es-AR')
  const fragmentList = karaoke.segments
    .map((s, i) => `- Fragmento ${i + 1} de ${karaoke.segments.length} — ${formatTime(s.start)} – ${formatTime(s.end)}`)
    .join('\n')
  const body = karaoke.segments.map((s) => `[${formatTime(s.start)} – ${formatTime(s.end)}] ${s.text.trim()}`).join('\n')
  return `# ${karaoke.name}\n**Fecha:** ${dateStr}\n\n${fragmentList}\n\n## Texto completo\n\n${body}\n`
}

export default function History() {
  const [recordings, setRecordings] = useState([])
  const [transcriptions, setTranscriptions] = useState([])
  const [karaokes, setKaraokes] = useState([])
  const [expandedKey, setExpandedKey] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [toasts, setToasts] = useState([])
  const [exporting, setExporting] = useState(null) // null | 'audio' | 'text'

  // Player state (inline: vive dentro de la tarjeta activa)
  const [activeKey, setActiveKey] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerTime, setPlayerTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const audioRef = useRef(null)

  // Karaoke panel state
  const [karaokeIndex, setKaraokeIndex] = useState(0)

  // Editing state
  const [editingKey, setEditingKey] = useState(null)
  const [editName, setEditName] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    loadRecordings()
    loadTranscriptions()
    loadKaraokes()
  }, [])

  const loadRecordings = async () => {
    const data = await getAllRecordings()
    setRecordings(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  }

  const loadTranscriptions = () => {
    setTranscriptions(getTranscriptions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  }

  const loadKaraokes = async () => {
    const data = await getAllKaraokes()
    setKaraokes(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  }

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  // Lista única: grabaciones + transcripciones + karaokes ordenadas por fecha
  const items = [
    ...recordings.map(r => ({ ...r, type: 'audio' })),
    ...transcriptions.map(t => ({ ...t, type: 'text' })),
    ...karaokes.map(k => ({ ...k, type: 'karaoke' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  const activeItem = items.find(i => itemKey(i) === activeKey) || null

  // Player Controls (inline dentro de la tarjeta)
  const openPlayer = (item) => {
    if (audioRef.current) audioRef.current.pause()
    setActiveKey(itemKey(item))
    setIsPlaying(false)
    setPlayerTime(0)
    if (item.type === 'karaoke') setKaraokeIndex(0)
    setTimeout(() => {
      if (audioRef.current) {
        audioRef.current.src = URL.createObjectURL(item.blob)
        audioRef.current.playbackRate = playbackRate
        audioRef.current.play()
        setIsPlaying(true)
      }
    }, 100)
  }

  const closePlayer = () => {
    if (audioRef.current) audioRef.current.pause()
    setActiveKey(null)
    setIsPlaying(false)
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) audioRef.current.pause()
    else audioRef.current.play()
    setIsPlaying(!isPlaying)
  }

  const changePlaybackRate = () => {
    const rates = [1, 1.5, 2, 0.5]
    const nextRate = rates[(rates.indexOf(playbackRate) + 1) % rates.length]
    setPlaybackRate(nextRate)
    if (audioRef.current) audioRef.current.playbackRate = nextRate
  }

  const handleTimeUpdate = () => {
    if (!audioRef.current) return
    const t = audioRef.current.currentTime
    setPlayerTime(t)

    // Sincronizar fragmento del karaoke con el audio en reproducción
    if (activeItem?.type === 'karaoke' && activeItem.segments?.length && expandedKey === itemKey(activeItem)) {
      const segs = activeItem.segments
      const cur = karaokeIndex
      if (t > segs[cur].end && cur < segs.length - 1) {
        setKaraokeIndex(cur + 1)
      } else if (t < segs[cur].start && cur > 0) {
        setKaraokeIndex(cur - 1)
      }
    }
  }

  const handleScrub = (e) => {
    if (audioRef.current) {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percent = x / rect.width
      audioRef.current.currentTime = percent * audioRef.current.duration
      setPlayerTime(audioRef.current.currentTime)
    }
  }

  const skipTime = (amount) => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime + amount
      audioRef.current.currentTime = Math.min(Math.max(newTime, 0), audioRef.current.duration)
      setPlayerTime(audioRef.current.currentTime)
    }
  }

  // Karaoke navigation (funciona con el panel abierto, aunque no se esté reproduciendo)
  const gotoFragment = (karaoke, idx) => {
    const segs = karaoke?.segments
    if (!segs?.length) return
    const clamped = Math.min(Math.max(idx, 0), segs.length - 1)
    setKaraokeIndex(clamped)
    // Si este karaoke está reproduciéndose, saltar el audio al inicio del fragmento
    if (audioRef.current && activeKey === itemKey(karaoke) && !audioRef.current.paused) {
      audioRef.current.currentTime = segs[clamped].start
      setPlayerTime(audioRef.current.currentTime)
    }
  }

  // Rename
  const handleRename = async (item) => {
    if (editName.trim() === '') return
    if (item.type === 'audio') {
      const { type, ...recording } = item
      await updateRecording({ ...recording, name: editName })
      await loadRecordings()
    } else if (item.type === 'karaoke') {
      const { type, ...karaoke } = item
      await updateKaraoke({ ...karaoke, name: editName })
      await loadKaraokes()
    } else {
      updateTranscription(item.id, { name: editName })
      loadTranscriptions()
    }
    setEditingKey(null)
    setEditName('')
  }

  // Delete
  const confirmDelete = (item) => {
    setItemToDelete(item)
    setDeleteModalOpen(true)
  }

  const executeDelete = async () => {
    if (!itemToDelete) return
    const { type } = itemToDelete
    if (type === 'audio') {
      await deleteRecording(itemToDelete.id)
      if (activeKey === itemKey(itemToDelete)) closePlayer()
      await loadRecordings()
    } else if (type === 'karaoke') {
      await deleteKaraoke(itemToDelete.id)
      if (activeKey === itemKey(itemToDelete)) closePlayer()
      if (expandedKey === itemKey(itemToDelete)) setExpandedKey(null)
      await loadKaraokes()
    } else {
      deleteTranscription(itemToDelete.id)
      if (expandedKey === itemKey(itemToDelete)) setExpandedKey(null)
      loadTranscriptions()
    }
    setDeleteModalOpen(false)
    setItemToDelete(null)
    addToast(type === 'audio' ? 'Grabación eliminada' : type === 'karaoke' ? 'Karaoke eliminado' : 'Transcripción eliminada', 'error')
  }

  // Save single item to Desktop
  const handleSaveAudio = async (item) => {
    try {
      addToast('Convirtiendo a MP3 y guardando...', 'info')
      await saveAudioToDesktop(item.blob, item.name)
      addToast('Audio guardado en el Escritorio como MP3', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const handleSaveText = async (item) => {
    try {
      await saveToDesktop(item.name, item.text)
      addToast('Archivo guardado en el Escritorio', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const handleExportKaraokeMd = async (item) => {
    try {
      await saveToDesktop(item.name, karaokeToMarkdown(item))
      addToast('Karaoke exportado como .md en el Escritorio', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text)
    addToast('Texto copiado al portapapeles', 'success')
  }

  const handleTranscribe = (item) => {
    addToast('Redirigiendo al transcriptor...', 'success')
    setTimeout(() => {
      navigate('/transcriptor', { state: { audioBlob: item.blob, fileName: item.name } })
    }, 800)
  }

  // Mass exports
  const handleMassExportAudio = async () => {
    if (recordings.length === 0) {
      addToast('No hay grabaciones para exportar', 'error')
      return
    }
    setExporting('audio')
    const folderName = `MIKIT_Grabaciones_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 5).replace(':', '')}`
    addToast(`Iniciando exportación de ${recordings.length} grabaciones...`, 'success')

    let done = 0
    for (const item of recordings) {
      try {
        addToast(`Procesando ${done + 1} de ${recordings.length}: ${item.name}`, 'success')
        await saveAudioToDesktop(item.blob, item.name, folderName)
        done++
      } catch (err) {
        addToast(`Exportación detenida en ${done}/${recordings.length}. Error en "${item.name}": ${err.message}`, 'error')
        setExporting(null)
        return
      }
    }
    addToast(`✅ ${done} grabaciones exportadas en carpeta "${folderName}"`, 'success')
    setExporting(null)
  }

  const handleMassExportText = async () => {
    if (transcriptions.length === 0) {
      addToast('No hay transcripciones para exportar', 'error')
      return
    }
    setExporting('text')
    const folderName = `MIKIT_Transcripciones_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}_${new Date().toTimeString().slice(0, 5).replace(':', '')}`
    addToast(`Iniciando exportación de ${transcriptions.length} transcripciones...`, 'success')

    let done = 0
    for (const item of transcriptions) {
      try {
        addToast(`Procesando ${done + 1} de ${transcriptions.length}: ${item.name}`, 'success')
        const dateStr = new Date(item.createdAt).toLocaleString('es-AR')
        const mdContent = `# Transcripción: ${item.name}\n**Fecha:** ${dateStr}\n\n---\n\n${item.text}`
        await saveToDesktop(item.name, mdContent, folderName)
        done++
      } catch (err) {
        addToast(`Exportación detenida en ${done}/${transcriptions.length}. Error en "${item.name}": ${err.message}`, 'error')
        setExporting(null)
        return
      }
    }
    addToast(`✅ ${done} transcripciones exportadas en carpeta "${folderName}"`, 'success')
    setExporting(null)
  }

  const renderInlinePlayer = (item) => {
    const isActive = activeKey === itemKey(item)
    if (!isActive) return null
    return (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        className="border-t border-white/5 bg-black/20 mt-4"
      >
        <div className="p-4 flex flex-col gap-3">
          <div className="flex items-center gap-4">
            <button onClick={() => skipTime(-10)} className="p-2 text-zinc-400 hover:text-white transition-colors" title="-10s">
              <RotateCcw size={18} />
            </button>
            <button onClick={togglePlay} className="w-12 h-12 flex-shrink-0 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform">
              {isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
            </button>
            <button onClick={() => skipTime(10)} className="p-2 text-zinc-400 hover:text-white transition-colors" title="+10s">
              <RotateCw size={18} />
            </button>

            <div className="flex-1 flex flex-col gap-2">
              <div
                className="h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer relative"
                onClick={handleScrub}
              >
                <motion.div
                  className="absolute top-0 left-0 h-full bg-brand-500"
                  style={{ width: audioRef.current?.duration ? `${(playerTime / audioRef.current.duration) * 100}%` : '0%' }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-500 font-mono">
                <span>{formatTime(playerTime)}</span>
                <span>{item.type === 'audio' ? item.duration : formatTime(item.duration)}</span>
              </div>
            </div>

            <button onClick={changePlaybackRate} className="px-3 py-1.5 glass rounded-lg text-xs font-bold text-white hover:bg-white/10 transition-colors flex items-center gap-1">
              <FastForward size={14} /> {playbackRate}x
            </button>
            <button onClick={closePlayer} className="p-2 text-zinc-500 hover:text-white transition-colors" title="Cerrar">
              <X size={18} />
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  const renderKaraokePanel = (item) => {
    const segs = item.segments || []
    if (segs.length === 0) return null
    const idx = karaokeIndex
    const frag = segs[idx]
    const isActive = activeKey === itemKey(item)

    return (
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: 'auto', opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        className="border-t border-white/5 bg-black/20 mt-4"
      >
        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <MicVocal size={18} className="text-fuchsia-400" />
              <span className="font-bold text-white">Karaoke</span>
              <span className="text-sm text-zinc-500 font-mono">({idx + 1}/{segs.length})</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={() => handleCopy(frag.text)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors" title="Copiar fragmento actual">
                Copiar frag.
              </button>
              <button onClick={() => handleCopy(item.text)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors" title="Copiar todo el texto">
                Copiar todo
              </button>
              <button onClick={() => setExpandedKey(null)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-white/5 text-zinc-300 hover:bg-white/10 transition-colors" title="Volver a la lista">
                Historial
              </button>
              <button onClick={() => handleExportKaraokeMd(item)} className="px-3 py-1.5 rounded-full text-xs font-bold bg-fuchsia-500/15 text-fuchsia-300 hover:bg-fuchsia-500/25 transition-colors" title="Exportar como .md">
                Exportar MD
              </button>
            </div>
          </div>

          {/* Fragment box */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => gotoFragment(item, idx - 1)}
              disabled={idx === 0}
              className="p-2 rounded-full text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Fragmento anterior"
            >
              <ChevronLeft size={24} />
            </button>

            <div className="flex-1 rounded-2xl bg-white/5 border border-white/10 p-6 flex flex-col items-center gap-3 text-center">
              <p className="text-lg text-white font-medium leading-relaxed">{frag.text}</p>
              <span className="text-sm font-mono text-fuchsia-400">{formatTime(frag.start)} – {formatTime(frag.end)}</span>
            </div>

            <button
              onClick={() => gotoFragment(item, idx + 1)}
              disabled={idx === segs.length - 1}
              className="p-2 rounded-full text-zinc-400 hover:text-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Fragmento siguiente"
            >
              <ChevronRight size={24} />
            </button>
          </div>

          {/* Controls */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-4">
              <button onClick={() => { skipTime(-10); }} className="p-2 text-zinc-400 hover:text-white transition-colors" title="-10s">
                <RotateCcw size={20} />
              </button>
              <button
                onClick={isActive ? togglePlay : () => openPlayer(item)}
                className="w-14 h-14 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 transition-transform"
                title={isActive && isPlaying ? 'Pausar' : 'Reproducir'}
              >
                {isActive && isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
              </button>
              <button onClick={() => skipTime(10)} className="p-2 text-zinc-400 hover:text-white transition-colors" title="+10s">
                <RotateCw size={20} />
              </button>
            </div>

            <div className="w-full flex flex-col gap-2">
              <div
                className="h-2 bg-white/10 rounded-full overflow-hidden cursor-pointer relative"
                onClick={handleScrub}
              >
                <motion.div
                  className="absolute top-0 left-0 h-full bg-fuchsia-500"
                  style={{ width: audioRef.current?.duration ? `${(playerTime / audioRef.current.duration) * 100}%` : '0%' }}
                />
              </div>
              <div className="flex justify-between text-xs text-zinc-500 font-mono">
                <span>{formatTime(playerTime)}</span>
                <span>{formatTime(item.duration)}</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col gap-8 relative pb-12">
      {/* Hidden Audio Element for Player (controlado desde la tarjeta activa) */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

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
                <h3 className="text-xl font-bold text-white">
                  {itemToDelete?.type === 'audio' ? 'Eliminar Grabación' : itemToDelete?.type === 'karaoke' ? 'Eliminar Karaoke' : 'Eliminar Transcripción'}
                </h3>
                <p className="text-sm text-zinc-400">
                  ¿Estás seguro de que quieres eliminar <span className="text-white font-medium">"{itemToDelete?.name}"</span>?
                  {itemToDelete?.type !== 'text' ? ' Esta acción no se puede deshacer.' : ''}
                </p>
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

      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-display font-bold text-white">Historial</h2>
          <p className="text-zinc-500">Tus grabaciones, transcripciones y karaokes en un solo lugar.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleMassExportAudio}
            disabled={exporting !== null || recordings.length === 0}
            className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar todas las grabaciones como MP3 en una carpeta del Escritorio"
          >
            {exporting === 'audio' ? <Loader2 size={16} className="animate-spin" /> : <FolderDown size={16} />}
            {exporting === 'audio' ? 'Exportando...' : 'Exportar Audios'}
          </button>
          <button
            onClick={handleMassExportText}
            disabled={exporting !== null || transcriptions.length === 0}
            className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar todas las transcripciones como archivos .md en una carpeta del Escritorio"
          >
            {exporting === 'text' ? <Loader2 size={16} className="animate-spin" /> : <FolderDown size={16} />}
            {exporting === 'text' ? 'Exportando...' : 'Exportar Textos'}
          </button>
        </div>
      </header>

      {/* Unified list */}
      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 border border-dashed border-white/10 rounded-3xl">
            No hay grabaciones, transcripciones ni karaokes todavía.
          </div>
        ) : (
          items.map((item, index) => {
            const key = itemKey(item)
            const type = item.type
            const isAudio = type === 'audio'
            const isKaraoke = type === 'karaoke'
            const isText = type === 'text'
            const isExpanded = expandedKey === key
            const canPlay = isAudio || isKaraoke
            const badgeClass = isAudio ? 'bg-brand-500/10 text-brand-400' : isKaraoke ? 'bg-fuchsia-500/10 text-fuchsia-400' : 'bg-blue-500/10 text-blue-400'

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
                className={`glass-card p-4 group hover:border-brand-500/30 overflow-hidden transition-all duration-300 ${isExpanded ? 'border-fuchsia-500/30' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {canPlay ? (
                      <button
                        onClick={() => {
                          if (isKaraoke) {
                            setExpandedKey(isExpanded ? null : key)
                            if (!isExpanded) setKaraokeIndex(0)
                          }
                          if (activeKey === key) togglePlay()
                          else openPlayer(item)
                        }}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${activeKey === key ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'bg-brand-500/10 text-brand-500 hover:bg-brand-500/20'}`}
                        title={isKaraoke ? (isExpanded ? 'Colapsar' : 'Abrir karaoke') : 'Reproducir'}
                      >
                        {activeKey === key && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                      </button>
                    ) : (
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : key)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${isExpanded ? 'bg-white/20 text-white' : 'bg-white/10 text-zinc-400 hover:bg-white/20'}`}
                        title={isExpanded ? 'Colapsar' : 'Ver transcripción'}
                      >
                        <ChevronRight size={20} className={`transition-transform duration-300 ${isExpanded ? 'rotate-90' : ''}`} />
                      </button>
                    )}

                    <div className="flex-1 min-w-0">
                      {editingKey === key ? (
                        <div className="flex gap-2 mr-4">
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            className="flex-1 bg-white/10 border border-white/20 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-brand-500"
                            autoFocus
                            onKeyDown={(e) => e.key === 'Enter' ? handleRename(item) : null}
                          />
                          <button onClick={() => handleRename(item)} className="p-1 text-green-400 hover:bg-green-400/10 rounded"><Check size={16} /></button>
                          <button onClick={() => { setEditingKey(null); setEditName(''); }} className="p-1 text-red-400 hover:bg-red-400/10 rounded"><X size={16} /></button>
                        </div>
                      ) : (
                        <>
                          <h4 className="font-semibold text-white group-hover:text-brand-400 transition-colors flex items-center gap-2 truncate">
                            <span className="truncate">{item.name}</span>
                            <button
                              onClick={() => { setEditingKey(key); setEditName(item.name); }}
                              className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-white transition-all flex-shrink-0"
                              title="Renombrar"
                            >
                              <Edit2 size={12} />
                            </button>
                          </h4>
                          <p className="text-xs text-zinc-500 flex items-center gap-2 flex-wrap">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${badgeClass}`}>
                              {isAudio ? 'Audio' : isKaraoke ? 'Karaoke' : 'Texto'}
                            </span>
                            {isAudio ? <span>{item.duration} •</span> : null}
                            {isKaraoke ? <span>{item.segments?.length || 0} fragmentos •</span> : null}
                            <span>{new Date(item.createdAt).toLocaleString()}</span>
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ml-4">
                    {isAudio ? (
                      <>
                        <button
                          onClick={() => handleSaveAudio(item)}
                          className="p-2 hover:bg-brand-500/10 rounded-lg text-brand-500 hover:text-brand-400 transition-colors"
                          title="Guardar en Escritorio (MP3)"
                        >
                          <Save size={18} />
                        </button>
                        <button
                          onClick={() => handleTranscribe(item)}
                          className="p-2 hover:bg-brand-500/10 rounded-lg text-brand-400 hover:text-brand-300 transition-colors"
                          title="Transcribir"
                        >
                          <FileText size={18} />
                        </button>
                      </>
                    ) : isKaraoke ? (
                      <>
                        <button
                          onClick={() => handleCopy(item.text)}
                          className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                          title="Copiar todo el texto"
                        >
                          <Copy size={18} />
                        </button>
                        <button
                          onClick={() => handleSaveAudio(item)}
                          className="p-2 hover:bg-brand-500/10 rounded-lg text-brand-500 hover:text-brand-400 transition-colors"
                          title="Guardar audio en Escritorio (MP3)"
                        >
                          <Save size={18} />
                        </button>
                        <button
                          onClick={() => handleExportKaraokeMd(item)}
                          className="p-2 hover:bg-fuchsia-500/10 rounded-lg text-fuchsia-400 hover:text-fuchsia-300 transition-colors"
                          title="Exportar karaoke como .md"
                        >
                          <FileText size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => handleCopy(item.text)}
                          className="p-2 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors"
                          title="Copiar texto"
                        >
                          <Copy size={18} />
                        </button>
                        <button
                          onClick={() => handleSaveText(item)}
                          className="p-2 hover:bg-brand-500/10 rounded-lg text-brand-500 hover:text-brand-400 transition-colors"
                          title="Guardar en Escritorio"
                        >
                          <Save size={18} />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => confirmDelete(item)}
                      className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
                      title="Eliminar"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Expanded panels (inline dentro de la tarjeta) */}
                <AnimatePresence>
                  {isKaraoke && isExpanded ? renderKaraokePanel(item) : null}
                </AnimatePresence>

                {/* Inline player para audio en reproducción (el karaoke tiene sus controles en el panel) */}
                {isAudio ? renderInlinePlayer(item) : null}

                {/* Expanded transcription text */}
                <AnimatePresence>
                  {isText && isExpanded ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="border-t border-white/5 bg-black/20 mt-4"
                    >
                      <div className="p-6">
                        <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">{item.text}</p>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            )
          })
        )}
      </div>
    </div>
  )
}