import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, Square, Play, Pause, Trash2, RotateCcw, RotateCw, FileText, Check, X, Volume2, FastForward, ChevronDown, Wrench, CircleAlert } from 'lucide-react'
import { saveRecording } from '../utils/storage'
import { getTemplates, getNoiseGateSettings, saveNoiseGateSettings } from '../utils/preferences'
import NoiseGateControl from '../components/NoiseGateControl'
import { useLevelMonitor } from '../hooks/useLevelMonitor'
import { useNavigate } from 'react-router-dom'

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
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [recordingName, setRecordingName] = useState('')
  const [templates, setTemplates] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [recentlySaved, setRecentlySaved] = useState(null)

  // Audio input devices (micrófono seleccionado, ej. Bluetooth de solapa)
  const [audioDevices, setAudioDevices] = useState([])
  const [selectedDeviceId, setSelectedDeviceId] = useState('')

  // Modal de configuración. Se declara ACÁ, y no con el resto de los UI States
  // de más abajo, porque `useLevelMonitor` de la línea siguiente lo lee: si se
  // declara después, el render tira "Cannot access 'isGateModalOpen' before
  // initialization" y la pantalla queda en blanco.
  const [isGateModalOpen, setIsGateModalOpen] = useState(false)

  // Puerta de ruido: el umbral arranca en null = "sin calibrar", y eso
  // mantiene bloqueada la grabación hasta que el usuario lo fije.
  const [gateThresholdDb, setGateThresholdDb] = useState(() => getNoiseGateSettings().thresholdDb)

  // El monitor sólo tiene sentido con el modal abierto: la barra vive adentro
  // del modal, así que mantener el micrófono capturado el resto del tiempo
  // sería dejarlo encendido al pedo (y con el indicador del sistema prendido).
  // Tampoco tiene sentido grabando: el grabador ya abre su propio stream.
  const { levelDb, error: monitorError } = useLevelMonitor({
    enabled: status === 'inactivo' && isGateModalOpen,
    deviceId: selectedDeviceId || undefined,
  })

  const handleThresholdChange = (db) => {
    setGateThresholdDb(db)
    saveNoiseGateSettings({ thresholdDb: db, enabled: true })
  }

  // Grabar exige micrófono elegido + puerta calibrada. Sin esto se
  // grabaría con ganancia y umbral arbitrarios.
  const micSelected = Boolean(selectedDeviceId)
  const gateCalibrated = typeof gateThresholdDb === 'number'
  const canRecord = micSelected && gateCalibrated
  const blockers = [
    !micSelected && 'seleccioná un micrófono',
    !gateCalibrated && 'calibrá la puerta de ruido',
  ].filter(Boolean)

  // UI States
  const [toasts, setToasts] = useState([])

  // Player state (banner post-guardado)
  const [activePlayer, setActivePlayer] = useState(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playerTime, setPlayerTime] = useState(0)
  const [playbackRate, setPlaybackRate] = useState(1)
  const audioRef = useRef(null)

  const mediaRecorder = useRef(null)
  const audioChunks = useRef([])
  const timerRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    setTemplates(getTemplates())

    // Para listar micrófonos con nombre real hay que tener permiso primero:
    // pedimos un stream mudo y lo cerramos inmediatamente, luego enumeramos.
    const initDevices = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        stream.getTracks().forEach(track => track.stop())
      } catch (err) {
        console.warn('Permiso de micrófono denegado, los nombres de dispositivos no estarán disponibles:', err)
      }
      loadDevices()
    }
    initDevices()

    // Actualiza la lista si se conecta/desconecta un dispositivo (ej. mic Bluetooth)
    navigator.mediaDevices.addEventListener?.('devicechange', loadDevices)
    return () => navigator.mediaDevices.removeEventListener?.('devicechange', loadDevices)
  }, [])

  // Escape cierra el modal de configuración. Un modal de calibración sin
  // salida por teclado deja al usuario atrapado en la pantalla.
  useEffect(() => {
    if (!isGateModalOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') setIsGateModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isGateModalOpen]);

  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const inputs = devices.filter(d => d.kind === 'audioinput')
      setAudioDevices(inputs)
      // Mantener la selección si el dispositivo sigue conectado; si no, quedará sin seleccionar
      setSelectedDeviceId(prev => {
        if (prev && inputs.some(d => d.deviceId === prev)) return prev
        return ''
      })
    } catch (err) {
      console.error('Error al enumerar dispositivos de audio:', err)
    }
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
      const audioConstraints = {
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

      // Si el usuario eligió un micrófono específico (ej. Bluetooth), usarlo
      if (selectedDeviceId) {
        audioConstraints.deviceId = { exact: selectedDeviceId }
      }

      const stream = await navigator.mediaDevices.getUserMedia({ audio: audioConstraints })

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
    addToast('Grabación guardada con éxito — la encontrás en Historial', 'success')
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

        {/* Acceso a Configuración adicional. Va dentro del card y no fuera:
            el card es `overflow-hidden`, así que un botón posicionado por
            fuera de sus límites quedaría recortado. Como es `absolute`, no
            participa del flex layout y no corre el contenido. */}
        <button
          onClick={() => setIsGateModalOpen(true)}
          disabled={status !== 'inactivo'}
          title={status !== 'inactivo' ? 'No se puede configurar con la grabación en curso' : 'Configuración adicional'}
          aria-label="Abrir configuración adicional"
          className={`absolute top-5 right-5 z-10 w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
            status !== 'inactivo'
              ? 'text-zinc-700 cursor-not-allowed'
              : !canRecord
                ? 'text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30'
                : 'text-zinc-400 hover:text-white hover:bg-white/10 border border-white/10'
          }`}
        >
          <Wrench size={17} />
          {/* Punto de atención: la configuración está incompleta. */}
          {!canRecord && status === 'inactivo' && (
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-zinc-900" />
          )}
        </button>

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
            disabled={status === 'inactivo' && !canRecord}
            title={status === 'inactivo' && !canRecord ? `Falta: ${blockers.join(' y ')}` : undefined}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl ${
              status === 'grabando'
                ? 'bg-red-600 hover:bg-red-500 shadow-red-600/30'
                : status === 'inactivo' && !canRecord
                  ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed shadow-none'
                  : 'bg-brand-600 hover:bg-brand-500 shadow-brand-600/30'
            }`}
          >
            {status === 'grabando' ? <Pause size={32} fill="currentColor" /> : <Mic size={32} fill="currentColor" />}
          </button>

          {/* Aviso de por qué el botón no está disponible. Sin esto el
              bloqueo parece un bug en vez de una regla. Es un botón: el
              mensaje que falta está en la tuerca, así que abrirla es la
              acción obvia y no obligamos a que el usuario la busque. */}
          {status === 'inactivo' && !canRecord && (
            <button
              onClick={() => setIsGateModalOpen(true)}
              className="mt-3 flex items-center justify-center gap-2 text-xs text-amber-400/90 hover:text-amber-300 transition-colors text-center"
            >
              <CircleAlert size={13} className="flex-shrink-0" />
              Para grabar: {blockers.join(' y ')}
            </button>
          )}

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

      {/* Configuración adicional: modal y no panel inline. Es una tarea
          puntual (calibrar una vez) y así la consola queda limpia. */}
      <AnimatePresence>
        {isGateModalOpen && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={(e) => { if (e.target === e.currentTarget) setIsGateModalOpen(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              role="dialog"
              aria-modal="true"
              aria-label="Configuración adicional"
              /* `.glass` y NO `.glass-card`: esa tiene `-translate-y-1` en
                 :hover y el modal se levantaría al arrastrar el umbral,
                 moviendo el slider fuera del cursor. */
              className="glass rounded-2xl shadow-2xl w-full max-w-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-start justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-brand-500/15 border border-brand-500/30 flex items-center justify-center flex-shrink-0">
                    <Wrench size={16} className="text-brand-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">Configuración adicional</h3>
                    <p className="text-xs text-zinc-500">Ajustes de captura de audio.</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsGateModalOpen(false)}
                  aria-label="Cerrar configuración"
                  className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="glass rounded-xl p-5 sm:p-6">
          <div className="grid gap-6 md:grid-cols-2 md:gap-8">
            {/* Selector de micrófono: el dispositivo al que se accede
                (ej. mic Bluetooth de solapa) */}
            <div className="min-w-0">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs uppercase tracking-wider text-zinc-500 flex items-center gap-2">
                  <Mic size={12} className={selectedDeviceId ? 'text-green-400' : 'text-zinc-500'} />
                  Micrófono
                </span>
              </div>
              <div className="relative">
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  disabled={status !== 'inactivo' || audioDevices.length === 0}
                  className={`w-full bg-transparent border rounded-xl px-4 py-2.5 pr-10 text-sm focus:outline-none transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    selectedDeviceId
                      ? 'border-green-500/60 text-green-400 focus:border-green-500'
                      : 'border-white/10 text-white/60 focus:border-brand-500'
                  }`}
                  title={audioDevices.length === 0 ? 'No se detectaron micrófonos. Conectá tu dispositivo y recargá la página.' : undefined}
                >
                  {audioDevices.length === 0 ? (
                    <option className="bg-zinc-900">Sin micrófonos detectados</option>
                  ) : (
                    <>
                      <option value="" className="bg-zinc-900">Sin seleccionar</option>
                      {audioDevices.map(device => (
                        <option key={device.deviceId} value={device.deviceId} className="bg-zinc-900">
                          {device.label || `Micrófono (${device.deviceId.slice(0, 8)}...)`}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none ${selectedDeviceId ? 'text-green-400' : 'text-zinc-500'}`}>
                  <ChevronDown size={16} />
                </div>
              </div>
              <p className="mt-3 text-xs text-zinc-500">
                {audioDevices.length === 0
                  ? 'No se detectaron micrófonos. Conectá uno y recargá la página.'
                  : selectedDeviceId
                    ? 'Se usará en la próxima grabación.'
                    : 'Elegí con cuál grabar. Podés cambiarlo sólo con la grabadora parada.'}
              </p>
            </div>

            {/* Puerta de ruido */}
            <div className="min-w-0">
              <NoiseGateControl
                levelDb={levelDb}
                thresholdDb={gateThresholdDb}
                onThresholdChange={handleThresholdChange}
                error={monitorError}
              />
            </div>
          </div>
          </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
    </div>
  )
}
