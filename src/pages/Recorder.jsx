import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Square, Play, Pause, Save, Trash2, RotateCcw, RotateCw, FileText, Edit2, Check, X, Copy, Volume2, FastForward, AlertCircle, Download, ChevronDown, FolderDown, Loader2 } from 'lucide-react'
import { saveRecording, getAllRecordings, deleteRecording, updateRecording } from '../utils/storage'
import { getTemplates } from '../utils/preferences'
import { useNavigate } from 'react-router-dom'
import { saveAudioToDesktop } from '../utils/api'

// Hoisted pure function (js-hoist-regexp best practice)
const formatTime = (seconds) => {
  const hrs = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  return `${hrs > 0 ? hrs.toString().padStart(2, '0') + ':' : ''}${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function Recorder() {
  const [status, setStatus] = useState('inactivo') // inactivo, grabando, pausado, detenido
  const [time, setTime] = useState(0)
  const [history, setHistory] = useState([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [recordingName, setRecordingName] = useState('')
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [recentlySaved, setRecentlySaved] = useState(null)
  
  // UI States
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)
  const [toasts, setToasts] = useState([])
  const [isExporting, setIsExporting] = useState(false)

  // Player state
  const [activePlayer, setActivePlayer] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerTime, setPlayerTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const audioRef = useRef(null)

  // Editing state
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  
  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const timerRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    loadHistory()
    setTemplates(getTemplates())
  }, [])

  const loadHistory = async () => {
    const data = await getAllRecordings()
    setHistory(data.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
  }

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          googEchoCancellation: false,
          googAutoGainControl: false,
          googNoiseSuppression: false,
          googHighpassFilter: false,
          googTypingNoiseDetection: false,
          channelCount: 2,
          sampleRate: 48000,
          sampleSize: 16
        } 
      })

      const options = { 
        mimeType: 'audio/webm;codecs=opus', 
        audioBitsPerSecond: 256000 
      }
      
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        delete options.mimeType
      }

      mediaRecorder.current = new MediaRecorder(stream, options)
      audioChunks.current = []

      mediaRecorder.current.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunks.current.push(event.data)
      }

      mediaRecorder.current.onstop = () => {
        setIsModalOpen(true)
      }

      mediaRecorder.current.start()
      setStatus('grabando')
      timerRef.current = setInterval(() => setTime(t => t + 1), 1000)
    } catch (err) {
      console.error('Error al acceder al micrófono:', err)
      alert('No se pudo acceder al micrófono. Por favor, verifica los permisos.')
    }
  }

  const pauseRecording = () => {
    mediaRecorder.current.pause()
    setStatus('pausado')
    clearInterval(timerRef.current)
  }

  const resumeRecording = () => {
    mediaRecorder.current.resume()
    setStatus('grabando')
    timerRef.current = setInterval(() => setTime(t => t + 1), 1000)
  }

  const stopRecording = () => {
    mediaRecorder.current.stop()
    mediaRecorder.current.stream.getTracks().forEach(track => track.stop())
    setStatus('detenido')
    clearInterval(timerRef.current)
  }

  const getPreviewName = () => {
    const dateStr = new Date().toLocaleDateString().replace(/\//g, '-')
    const tmplStr = selectedTemplate ? `${selectedTemplate} ` : ''
    const nameStr = recordingName ? recordingName : 'Nueva Grabación'
    return `${dateStr} ${tmplStr}${nameStr}`.trim()
  }

  const handleSave = async () => {
    const mimeType = mediaRecorder.current?.mimeType || 'audio/webm'
    const blob = new Blob(audioChunks.current, { type: mimeType })
    const finalName = getPreviewName()
    const metadata = {
      name: finalName,
      duration: formatTime(time),
    }
    const savedId = await saveRecording(blob, metadata)
    
    // Configurar reproductor rápido
    setRecentlySaved({
      id: savedId,
      blob,
      name: finalName,
      duration: formatTime(time),
      createdAt: new Date().toISOString()
    })

    setIsModalOpen(false)
    setRecordingName('')
    setSelectedTemplate('')
    setTime(0)
    setStatus('inactivo')
    loadHistory()
    addToast('Grabación guardada con éxito', 'success')
  }

  const confirmDelete = (item) => {
    setItemToDelete(item)
    setDeleteModalOpen(true)
  }

  const executeDelete = async () => {
    if (!itemToDelete) return
    await deleteRecording(itemToDelete.id)
    if (activePlayer?.id === itemToDelete.id) closePlayer()
    if (recentlySaved?.id === itemToDelete.id) setRecentlySaved(null)
    loadHistory()
    setDeleteModalOpen(false)
    setItemToDelete(null)
    addToast('Grabación eliminada del historial', 'error')
  }

  const handleRename = async (item) => {
    if (editName.trim() === '') return
    await updateRecording({ ...item, name: editName })
    setEditingId(null)
    setEditName('')
    if (activePlayer?.id === item.id) setActivePlayer(prev => ({ ...prev, name: editName }))
    loadHistory()
  }

  const handleSaveToDesktop = async (item) => {
    try {
      addToast('Convirtiendo a MP3 y guardando...', 'info')
      await saveAudioToDesktop(item.blob, item.name)
      addToast('Audio guardado en el Escritorio como MP3', 'success')
    } catch (err) {
      addToast(err.message, 'error')
    }
  }

  const handleMassExportRecordings = async () => {
    if (history.length === 0) {
      addToast('No hay grabaciones para exportar', 'error')
      return
    }
    setIsExporting(true)
    const folderName = `MIKIT_Grabaciones_${new Date().toISOString().slice(0,10).replace(/-/g,'')}_${new Date().toTimeString().slice(0,5).replace(':','')}`
    addToast(`Iniciando exportación de ${history.length} grabaciones...`, 'success')

    let done = 0
    for (const item of history) {
      try {
        addToast(`Procesando ${done + 1} de ${history.length}: ${item.name}`, 'success')
        await saveAudioToDesktop(item.blob, item.name, folderName)
        done++
      } catch (err) {
        addToast(`Exportación detenida en ${done}/${history.length}. Error en "${item.name}": ${err.message}`, 'error')
        setIsExporting(false)
        return
      }
    }
    addToast(`✅ ${done} grabaciones exportadas en carpeta "${folderName}"`, 'success')
    setIsExporting(false)
  }

  const handleTranscribe = (recording) => {
    addToast('Redirigiendo al transcriptor...', 'success')
    setTimeout(() => {
      navigate('/transcriptor', { state: { audioBlob: recording.blob, fileName: recording.name } })
    }, 800)
  }

  // Player Controls
  const openPlayer = (item) => {
    if (audioRef.current) {
      audioRef.current.pause()
    }
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

  return (
    <div className="flex flex-col gap-8 relative">
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
                <h3 className="text-xl font-bold text-white">Eliminar Grabación</h3>
                <p className="text-sm text-zinc-400">¿Estás seguro de que quieres eliminar <span className="text-white font-medium">"{itemToDelete?.name}"</span>? Esta acción no se puede deshacer.</p>
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
        {isModalOpen ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 w-full max-w-md space-y-6"
            >
              <h3 className="text-2xl font-bold text-white">Guardar Grabación</h3>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Plantilla de Nombre (Opcional)</label>
                  <div className="relative">
                    <select 
                      value={selectedTemplate}
                      onChange={(e) => setSelectedTemplate(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-zinc-900">Sin plantilla</option>
                      {templates.map((t, i) => (
                        <option key={i} value={t} className="bg-zinc-900">{t}</option>
                      ))}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                      <ChevronDown size={18} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Nombre Específico</label>
                  <input 
                    type="text" 
                    value={recordingName}
                    onChange={(e) => setRecordingName(e.target.value)}
                    placeholder="Ej. Notas de la reunión"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                    autoFocus
                  />
                </div>

                <div className="p-4 rounded-xl bg-brand-500/10 border border-brand-500/20">
                  <p className="text-xs text-brand-400 mb-1">Vista Previa del Nombre:</p>
                  <p className="text-sm text-white font-medium break-all">{getPreviewName()}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <button 
                  onClick={() => { setIsModalOpen(false); setStatus('inactivo'); setTime(0); }}
                  className="btn-secondary flex-1"
                >
                  Descartar
                </button>
                <button onClick={handleSave} className="btn-primary flex-1">
                  Guardar
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Recording Console */}
      <div className="glass-card p-12 flex flex-col items-center justify-center gap-12 relative overflow-hidden">
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full blur-[100px] transition-all duration-700 ${status === 'grabando' ? 'bg-red-500/20 scale-150' : 'bg-brand-500/10'}`} />

        <div className="text-center space-y-4 relative">
          <h2 className="text-6xl font-display font-bold tracking-tighter tabular-nums text-white">
            {formatTime(time)}
          </h2>
          <div className="flex items-center justify-center gap-2">
            <div className={`w-2 h-2 rounded-full ${status === 'grabando' ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`} />
            <span className="text-sm font-medium uppercase tracking-widest text-zinc-500">
              {status === 'inactivo' ? 'Listo para grabar' : status}
            </span>
          </div>
        </div>

        {/* Visualizer */}
        <div className="w-full max-w-2xl h-32 flex items-center justify-center gap-1">
          {Array.from({ length: 40 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ 
                height: status === 'grabando' ? [20, Math.random() * 80 + 20, 20] : 4
              }}
              transition={{ repeat: Infinity, duration: 0.5 + Math.random(), ease: "easeInOut" }}
              className={`w-1 rounded-full ${status === 'grabando' ? 'bg-brand-500' : 'bg-zinc-800'}`}
            />
          ))}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-6 relative">
          <AnimatePresence>
            {(status === 'grabando' || status === 'pausado') ? (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => { stopRecording(); setStatus('inactivo'); setTime(0); }}
                className="w-14 h-14 rounded-full glass flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-all"
              >
                <RotateCcw size={24} />
              </motion.button>
            ) : null}
          </AnimatePresence>

          <button
            onClick={() => {
              if (status === 'inactivo') startRecording();
              else if (status === 'grabando') pauseRecording();
              else if (status === 'pausado') resumeRecording();
            }}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
              status === 'grabando' 
                ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30' 
                : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/30'
            }`}
          >
            {status === 'grabando' ? <Pause size={32} fill="currentColor" /> : <Mic size={32} fill="currentColor" />}
          </button>

          <AnimatePresence>
            {(status === 'grabando' || status === 'pausado') ? (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={stopRecording}
                className="w-14 h-14 rounded-full bg-zinc-200 text-black flex items-center justify-center hover:bg-white transition-all shadow-xl"
              >
                <Square size={24} fill="currentColor" />
              </motion.button>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* Post-Recording Player */}
      <AnimatePresence>
        {recentlySaved && !activePlayer ? (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-4 flex items-center justify-between border-green-500/30 bg-green-500/5"
          >
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-green-500/20 flex items-center justify-center text-green-400">
                <Check size={20} />
              </div>
              <div>
                <h4 className="font-semibold text-white">Grabación Guardada</h4>
                <p className="text-xs text-zinc-400">{recentlySaved.name}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openPlayer(recentlySaved)} className="btn-secondary px-4 py-2 text-sm flex items-center gap-2">
                <Play size={16} /> Reproducir
              </button>
              <button onClick={() => handleTranscribe(recentlySaved)} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
                <FileText size={16} /> Transcribir
              </button>
              <button onClick={() => setRecentlySaved(null)} className="p-2 hover:bg-white/10 rounded-lg text-zinc-400">
                <X size={18} />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

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

      {/* History */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-xl font-display font-bold text-white">Historial de Grabaciones</h3>
          <button
            onClick={handleMassExportRecordings}
            disabled={isExporting || history.length === 0}
            className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar todas las grabaciones como MP3 en una carpeta del Escritorio"
          >
            {isExporting ? <Loader2 size={16} className="animate-spin" /> : <FolderDown size={16} />}
            {isExporting ? 'Exportando...' : 'Exportar Todo'}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 pb-8">
          {history.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 border border-dashed border-white/10 rounded-3xl">
              No hay grabaciones guardadas.
            </div>
          ) : (
            history.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card p-4 flex items-center justify-between group hover:border-brand-500/30"
              >
                <div className="flex items-center gap-4 flex-1">
                  <button 
                    onClick={() => openPlayer(item)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${activePlayer?.id === item.id ? 'bg-brand-500 text-white shadow-lg shadow-brand-500/20' : 'bg-brand-500/10 text-brand-500 hover:bg-brand-500/20'}`}
                  >
                    {activePlayer?.id === item.id && isPlaying ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
                  </button>
                  
                  <div className="flex-1">
                    {editingId === item.id ? (
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
                        <button onClick={() => setEditingId(null)} className="p-1 text-red-400 hover:bg-red-400/10 rounded"><X size={16} /></button>
                      </div>
                    ) : (
                      <>
                        <h4 className="font-semibold text-white group-hover:text-brand-400 transition-colors flex items-center gap-2">
                          {item.name}
                          <button onClick={() => { setEditingId(item.id); setEditName(item.name); }} className="opacity-0 group-hover:opacity-100 p-1 text-zinc-500 hover:text-white transition-all"><Edit2 size={12} /></button>
                        </h4>
                        <p className="text-xs text-zinc-500">{item.duration} • {new Date(item.createdAt).toLocaleString()}</p>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => handleSaveToDesktop(item)}
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
                  <button 
                    onClick={() => confirmDelete(item)}
                    className="p-2 hover:bg-red-500/10 rounded-lg text-zinc-500 hover:text-red-500 transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
