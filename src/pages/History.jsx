import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, Volume2, FastForward, RotateCcw, RotateCw, FileText, Edit2, Check, X, Copy, Save, Trash2, AlertCircle, FolderDown, Loader2, ChevronRight } from 'lucide-react'
import { getAllRecordings, deleteRecording, updateRecording } from '../utils/storage'
import { getTranscriptions, deleteTranscription, updateTranscription } from '../utils/preferences'
import { saveAudioToDesktop, saveToDesktop } from '../utils/api'
import { useNavigate } from 'react-router-dom'

const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hrs > 0 ? hrs.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// Clave única por tipo (grabaciones: id numérico; transcripciones: id string)
const itemKey = (item) => `${item.type}:${item.id}`

export default function History() {
  const [recordings, setRecordings] = useState([])
  const [transcriptions, setTranscriptions] = useState([])
  const [expandedKey, setExpandedKey] = useState(null)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [toasts, setToasts] = useState([])
  const [exporting, setExporting] = useState(null) // null | 'audio' | 'text'

  // Player state
  const [activePlayer, setActivePlayer] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerTime, setPlayerTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const audioRef = useRef(null)

  // Editing state
  const [editingKey, setEditingKey] = useState(null)
  const [editName, setEditName] = useState('')

  const navigate = useNavigate()

  useEffect(() => {
    loadRecordings()
    loadTranscriptions()
  }, [])

  const loadRecordings = async () => {
    const data = await getAllRecordings()
    setRecordings(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  }

  const loadTranscriptions = () => {
    setTranscriptions(getTranscriptions().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  }

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  // Lista única: grabaciones + transcripciones ordenadas por fecha
  const items = [
    ...recordings.map(r => ({ ...r, type: 'audio' })),
    ...transcriptions.map(t => ({ ...t, type: 'text' })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

  // Player Controls
  const openPlayer = (item) => {
    if (audioRef.current) audioRef.current.pause()
    setActivePlayer(item)
    setIsPlaying(false)
    setPlayerTime(0)
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
    setActivePlayer(null)
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
    if (audioRef.current) setPlayerTime(audioRef.current.currentTime)
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

  // Rename
  const handleRename = async (item) => {
    if (editName.trim() === '') return
    if (item.type === 'audio') {
      const { type, ...recording } = item
      await updateRecording({ ...recording, name: editName })
      if (activePlayer?.id === item.id) setActivePlayer(prev => ({ ...prev, name: editName }))
      await loadRecordings()
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
    const isAudio = itemToDelete.type === 'audio'
    if (isAudio) {
      await deleteRecording(itemToDelete.id)
      if (activePlayer?.id === itemToDelete.id) closePlayer()
      await loadRecordings()
    } else {
      deleteTranscription(itemToDelete.id)
      if (expandedKey === itemKey(itemToDelete)) setExpandedKey(null)
      loadTranscriptions()
    }
    setDeleteModalOpen(false)
    setItemToDelete(null)
    addToast(isAudio ? 'Grabación eliminada' : 'Transcripción eliminada', 'error')
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

  return (
    <div className="flex flex-col gap-8 relative pb-12">
      {/* Hidden Audio Element for Player */}
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
                  {itemToDelete?.type === 'audio' ? 'Eliminar Grabación' : 'Eliminar Transcripción'}
                </h3>
                <p className="text-sm text-zinc-400">
                  ¿Estás seguro de que quieres eliminar <span className="text-white font-medium">"{itemToDelete?.name}"</span>?
                  {itemToDelete?.type === 'audio' ? ' Esta acción no se puede deshacer.' : ''}
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
          <p className="text-zinc-500">Tus grabaciones y transcripciones en un solo lugar.</p>
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

      {/* Active Player */}
      <AnimatePresence>
        {activePlayer ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="glass-card p-6 border-brand-500/30 flex flex-col gap-4 relative overflow-hidden"
          >
            <button onClick={closePlayer} className="absolute top-4 right-4 text-zinc-500 hover:text-white">
              <X size={20} />
            </button>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-brand-500/20 flex items-center justify-center text-brand-400">
                <Volume2 size={24} />
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">{activePlayer.name}</h4>
                <p className="text-sm text-zinc-400">Reproduciendo ahora</p>
              </div>
            </div>

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
                  <span>{activePlayer.duration}</span>
                </div>
              </div>

              <button onClick={changePlaybackRate} className="px-3 py-1.5 glass rounded-lg text-xs font-bold text-white hover:bg-white/10 transition-colors flex items-center gap-1">
                <FastForward size={14} /> {playbackRate}x
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Unified list */}
      <div className="flex flex-col gap-3">
        {items.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 border border-dashed border-white/10 rounded-3xl">
            No hay grabaciones ni transcripciones todavía.
          </div>
        ) : (
          items.map((item, index) => {
            const key = itemKey(item)
            const isAudio = item.type === 'audio'
            const isExpanded = expandedKey === key

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index * 0.05, 0.5) }}
                className="glass-card p-4 group hover:border-brand-500/30 overflow-hidden transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    {isAudio ? (
                      <button
                        onClick={() => openPlayer(item)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${activePlayer?.id === item.id ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'bg-brand-500/10 text-brand-500 hover:bg-brand-500/20'}`}
                      >
                        {activePlayer?.id === item.id && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                      </button>
                    ) : (
                      <button
                        onClick={() => setExpandedKey(isExpanded ? null : key)}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors flex-shrink-0 ${isExpanded ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'}`}
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
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${isAudio ? 'bg-brand-500/10 text-brand-400' : 'bg-blue-500/10 text-blue-400'}`}>
                              {isAudio ? 'Audio' : 'Texto'}
                            </span>
                            {isAudio ? <span>{item.duration} •</span> : null}
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

                {/* Expanded transcription text */}
                <AnimatePresence>
                  {!isAudio && isExpanded ? (
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
