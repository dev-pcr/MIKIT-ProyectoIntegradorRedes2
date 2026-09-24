import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Plus, Trash2, ShieldCheck, LayoutTemplate, AlertCircle, Check, Edit2, MicVocal, Braces, MessageSquareText, Eye, X, ChevronDown } from 'lucide-react'
import { getApiKeys, saveApiKeys, getTextApiKeys, saveTextApiKeys, getTemplates, saveTemplates, getPromptTemplates, savePromptTemplates } from '../utils/preferences'

const maskKey = (keyString) => {
  if (keyString.length <= 8) return '********';
  return `${keyString.slice(0, 4)}...${keyString.slice(-4)}`;
}

function CollapsibleSection({ title, description, icon, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className="space-y-4">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 text-left group"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3 text-white">
          {icon}
          <div>
            <h3 className="text-xl font-bold group-hover:text-brand-400 transition-colors">{title}</h3>
            {description ? <p className="text-xs text-zinc-500">{description}</p> : null}
          </div>
        </div>
        <ChevronDown className={`flex-shrink-0 transition-transform duration-300 ${open ? 'rotate-180 text-brand-400' : 'text-zinc-500 group-hover:text-white'}`} />
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.2, 0.65, 0.3, 0.9] }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  )
}

function ApiKeysSection({ keys, newAlias, setNewAlias, newValue, setNewValue, onAdd, onActivate, onDelete, emptyText, placeholder = 'API Key (gsk_...)' }) {
  return (
    <div className="glass-card divide-y divide-white/5">
      <div className="p-6 bg-brand-500/5 flex items-start gap-4">
        <div className="p-2 rounded-lg bg-brand-500/10 text-brand-500">
          <ShieldCheck size={20} />
        </div>
        <div>
          <p className="text-sm text-zinc-300 font-medium">Seguridad de Datos</p>
          <p className="text-xs text-zinc-500">Tus claves se guardan localmente en `localStorage` y nunca se envían a nuestros servidores.</p>
        </div>
      </div>

      {keys.map((k) => (
        <div key={k.id} className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-2 h-2 rounded-full ${k.active ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-zinc-700'}`} />
            <div>
              <p className="font-semibold text-white">{k.alias}</p>
              <p className="text-xs font-mono text-zinc-500">{k.active ? 'Activa' : 'Inactiva'} · {maskKey(k.key)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!k.active ? (
              <button onClick={() => onActivate(k.id)} className="px-3 py-1.5 text-xs font-medium glass hover:bg-white/10 rounded-lg transition-all text-white">
                Activar
              </button>
            ) : null}
            <button onClick={() => onDelete(k)} className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ))}

      {keys.length === 0 ? (
        <div className="p-6 text-center text-zinc-500 text-sm">
          {emptyText}
        </div>
      ) : null}

      <div className="p-6 flex gap-3">
        <input
          type="text"
          value={newAlias}
          onChange={(e) => setNewAlias(e.target.value)}
          placeholder="Alias (ej. Mi Clave)"
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors"
        />
        <input
          type="password"
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          placeholder={placeholder}
          className="flex-[2] bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors"
        />
        <button onClick={onAdd} className="btn-primary py-2 px-4 whitespace-nowrap">
          <Plus size={18} /> Agregar
        </button>
      </div>
    </div>
  )
}

export default function Settings() {
  const [keys, setKeys] = useState([])
  const [textKeys, setTextKeys] = useState([])
  const [templates, setTemplates] = useState([])
  const [promptTemplates, setPromptTemplates] = useState([])
  
  const [newKeyAlias, setNewKeyAlias] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [newTextKeyAlias, setNewTextKeyAlias] = useState('')
  const [newTextKeyValue, setNewTextKeyValue] = useState('')
  const [newTemplate, setNewTemplate] = useState('')

  // UI States (Alerts & Confirmations)
  const [toasts, setToasts] = useState([])
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)

  // Template edit modal
  const [editTemplateModal, setEditTemplateModal] = useState(false)
  const [editTemplateIndex, setEditTemplateIndex] = useState(null)
  const [editTemplateValue, setEditTemplateValue] = useState('')

  // Prompt template edit modal
  const [editPromptModal, setEditPromptModal] = useState(false)
  const [editPromptIndex, setEditPromptIndex] = useState(null)
  const [editPromptName, setEditPromptName] = useState('')
  const [editPromptText, setEditPromptText] = useState('')

  // Prompt template view modal
  const [viewPromptModal, setViewPromptModal] = useState(false)
  const [viewPrompt, setViewPrompt] = useState(null)

  useEffect(() => {
    setKeys(getApiKeys())
    setTextKeys(getTextApiKeys())
    setTemplates(getTemplates())
    setPromptTemplates(getPromptTemplates())
  }, [])

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }

  const handleAddKey = () => {
    if (!newKeyAlias || !newKeyValue) return
    
    setKeys(prevKeys => {
      const newKey = {
        id: Date.now().toString(),
        alias: newKeyAlias,
        key: newKeyValue,
        active: prevKeys.length === 0
      }
      const updatedKeys = [...prevKeys, newKey]
      saveApiKeys(updatedKeys)
      return updatedKeys
    })
    
    setNewKeyAlias('')
    setNewKeyValue('')
    addToast('Clave API de audio agregada exitosamente', 'success')
  }

  const handleAddTextKey = () => {
    if (!newTextKeyAlias || !newTextKeyValue) return
    
    setTextKeys(prevKeys => {
      const newKey = {
        id: Date.now().toString(),
        alias: newTextKeyAlias,
        key: newTextKeyValue,
        active: prevKeys.length === 0
      }
      const updatedKeys = [...prevKeys, newKey]
      saveTextApiKeys(updatedKeys)
      return updatedKeys
    })
    
    setNewTextKeyAlias('')
    setNewTextKeyValue('')
    addToast('Clave API de texto agregada exitosamente', 'success')
  }

  const confirmDeleteKey = (k, pool = 'audio') => {
    setItemToDelete({ type: 'key', pool, data: k })
    setDeleteModalOpen(true)
  }

  const confirmDeleteTemplate = (t) => {
    setItemToDelete({ type: 'template', data: t })
    setDeleteModalOpen(true)
  }

  const confirmDeletePrompt = (p) => {
    setItemToDelete({ type: 'prompt', data: p })
    setDeleteModalOpen(true)
  }

  const executeDelete = () => {
    if (!itemToDelete) return

    if (itemToDelete.type === 'key') {
      const id = itemToDelete.data.id
      const pool = itemToDelete.pool || 'audio'
      if (pool === 'text') {
        setTextKeys(prevKeys => {
          const updatedKeys = prevKeys.filter(k => k.id !== id)
          if (updatedKeys.length > 0 && !updatedKeys.some(k => k.active)) {
            updatedKeys[0].active = true
          }
          saveTextApiKeys(updatedKeys)
          return updatedKeys
        })
      } else {
        setKeys(prevKeys => {
          const updatedKeys = prevKeys.filter(k => k.id !== id)
          if (updatedKeys.length > 0 && !updatedKeys.some(k => k.active)) {
            updatedKeys[0].active = true
          }
          saveApiKeys(updatedKeys)
          return updatedKeys
        })
      }
      addToast('Clave API eliminada', 'error')
    } else if (itemToDelete.type === 'template') {
      const templateToDelete = itemToDelete.data
      setTemplates(prevTemplates => {
        const updatedTemplates = prevTemplates.filter(t => t !== templateToDelete)
        saveTemplates(updatedTemplates)
        return updatedTemplates
      })
      addToast('Plantilla eliminada', 'error')
    } else if (itemToDelete.type === 'prompt') {
      const promptToDelete = itemToDelete.data
      setPromptTemplates(prevTemplates => {
        const updatedTemplates = prevTemplates.filter(p => p.id !== promptToDelete.id)
        savePromptTemplates(updatedTemplates)
        return updatedTemplates
      })
      addToast('Plantilla de prompt eliminada', 'error')
    }

    setDeleteModalOpen(false)
    setItemToDelete(null)
  }

  const handleActivateKey = (id) => {
    setKeys(prevKeys => {
      const updatedKeys = prevKeys.map(k => ({
        ...k,
        active: k.id === id
      }))
      saveApiKeys(updatedKeys)
      return updatedKeys
    })
    addToast('Clave API de audio activada', 'success')
  }

  const handleActivateTextKey = (id) => {
    setTextKeys(prevKeys => {
      const updatedKeys = prevKeys.map(k => ({
        ...k,
        active: k.id === id
      }))
      saveTextApiKeys(updatedKeys)
      return updatedKeys
    })
    addToast('Clave API de texto activada', 'success')
  }

  const handleAddTemplate = () => {
    if (!newTemplate) return
    
    setTemplates(prevTemplates => {
      const updatedTemplates = [...prevTemplates, newTemplate]
      saveTemplates(updatedTemplates)
      return updatedTemplates
    })
    setNewTemplate('')
    addToast('Plantilla guardada', 'success')
  }

  const handleOpenEditTemplate = (index, value) => {
    setEditTemplateIndex(index)
    setEditTemplateValue(value)
    setEditTemplateModal(true)
  }

  const handleSaveEditTemplate = () => {
    if (!editTemplateValue.trim()) return
    setTemplates(prevTemplates => {
      const updated = prevTemplates.map((t, i) => i === editTemplateIndex ? editTemplateValue.trim() : t)
      saveTemplates(updated)
      return updated
    })
    setEditTemplateModal(false)
    setEditTemplateIndex(null)
    setEditTemplateValue('')
    addToast('Plantilla actualizada', 'success')
  }

  // Prompt template: agregar / editar / eliminar
  const handleSavePrompt = () => {
    if (!editPromptName.trim()) return
    const saved = { id: editPromptIndex ?? Date.now().toString(), name: editPromptName.trim(), text: editPromptText }
    setPromptTemplates(prevTemplates => {
      const exists = prevTemplates.some(p => p.id === saved.id)
      const updated = exists
        ? prevTemplates.map(p => p.id === saved.id ? { ...p, ...saved } : p)
        : [...prevTemplates, saved]
      savePromptTemplates(updated)
      return updated
    })
    setEditPromptModal(false)
    setEditPromptIndex(null)
    setEditPromptName('')
    setEditPromptText('')
    addToast('Plantilla de prompt guardada', 'success')
  }

  const handleOpenNewPrompt = () => {
    setEditPromptIndex(null)
    setEditPromptName('')
    setEditPromptText('')
    setEditPromptModal(true)
  }

  const handleOpenEditPrompt = (p) => {
    setEditPromptIndex(p.id)
    setEditPromptName(p.name)
    setEditPromptText(p.text)
    setEditPromptModal(true)
  }

  const handleViewPrompt = (p) => {
    setViewPrompt(p)
    setViewPromptModal(true)
  }

  return (
    <div className="space-y-12 max-w-4xl mx-auto relative">
      <header className="space-y-2">
        <h2 className="text-3xl font-display font-bold text-white">Configuración</h2>
        <p className="text-zinc-500">Administra tus claves de API, plantillas y preferencias del sistema.</p>
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

      {/* Edit Template Modal */}
      <AnimatePresence>
        {editTemplateModal ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 w-full max-w-sm space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <Edit2 size={20} />
                </div>
                <h3 className="text-xl font-bold text-white">Editar Plantilla</h3>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-zinc-400">Nombre de la plantilla</label>
                <input
                  type="text"
                  value={editTemplateValue}
                  onChange={(e) => setEditTemplateValue(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' ? handleSaveEditTemplate() : null}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditTemplateModal(false); setEditTemplateIndex(null); setEditTemplateValue(''); }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button onClick={handleSaveEditTemplate} className="btn-primary flex-1">Guardar</button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* Edit Prompt Template Modal */}
      <AnimatePresence>
        {editPromptModal ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 w-full max-w-3xl space-y-6"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500">
                  <MessageSquareText size={20} />
                </div>
                <h3 className="text-xl font-bold text-white">{editPromptIndex ? 'Editar' : 'Nueva'} Plantilla de Prompt</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Nombre</label>
                  <input
                    type="text"
                    value={editPromptName}
                    onChange={(e) => setEditPromptName(e.target.value)}
                    placeholder="Ej. Resumen de clase"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all"
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-zinc-400">Texto del prompt</label>
                  <textarea
                    value={editPromptText}
                    onChange={(e) => setEditPromptText(e.target.value)}
                    placeholder="Escribí la instrucción que le vas a dar al modelo de IA..."
                    rows={14}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-500 transition-all resize-y min-h-[300px] text-sm leading-relaxed"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setEditPromptModal(false); setEditPromptIndex(null); setEditPromptName(''); setEditPromptText(''); }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button onClick={handleSavePrompt} className="btn-primary flex-1">Guardar</button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

      {/* View Prompt Template Modal */}
      <AnimatePresence>
        {viewPromptModal && viewPrompt ? (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="glass-card p-8 w-full max-w-3xl space-y-6"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-brand-500/10 flex items-center justify-center text-brand-500 flex-shrink-0">
                    <Eye size={20} />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xl font-bold text-white truncate">{viewPrompt.name}</h3>
                    <p className="text-xs text-zinc-500">Plantilla de prompt</p>
                  </div>
                </div>
                <button
                  onClick={() => setViewPromptModal(false)}
                  className="p-2 hover:bg-white/5 text-zinc-500 hover:text-white rounded-lg transition-all flex-shrink-0"
                  title="Cerrar"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 whitespace-pre-wrap break-words text-zinc-200 text-sm leading-relaxed max-h-[60vh] overflow-y-auto">
                {viewPrompt.text || <span className="text-zinc-600 italic">(sin texto)</span>}
              </div>
              <div className="flex gap-3">
                <button onClick={() => setViewPromptModal(false)} className="btn-secondary flex-1">Cerrar</button>
                <button
                  onClick={() => { setViewPromptModal(false); handleOpenEditPrompt(viewPrompt); }}
                  className="btn-primary flex w-[40%] items-center justify-center gap-2"
                >
                  <Edit2 size={16} /> Editar
                </button>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>

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
                <h3 className="text-xl font-bold text-white">Confirmar Eliminación</h3>
                <p className="text-sm text-zinc-400">
                  ¿Estás seguro de que quieres eliminar {itemToDelete?.type === 'key' ? (itemToDelete.pool === 'text' ? 'la clave de texto' : 'la clave de audio') : itemToDelete?.type === 'prompt' ? 'la plantilla de prompt' : 'la plantilla'} <span className="text-white font-medium">"{itemToDelete?.type === 'key' ? itemToDelete.data.alias : itemToDelete?.type === 'prompt' ? itemToDelete.data.name : itemToDelete?.data}"</span>?
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

      {/* Groq API Keys Section */}
      <CollapsibleSection
        title="Claves API de Groq para audio"
        description="Administra las claves usadas para transcribir audio en el Transcriptor."
        icon={<MicVocal className="text-brand-500" />}
        defaultOpen
      >
        <ApiKeysSection
          keys={keys}
          newAlias={newKeyAlias}
          setNewAlias={setNewKeyAlias}
          newValue={newKeyValue}
          setNewValue={setNewKeyValue}
          onAdd={handleAddKey}
          onActivate={handleActivateKey}
          onDelete={(k) => confirmDeleteKey(k, 'audio')}
          emptyText="No hay claves registradas. Agrega una para poder usar el transcriptor."
          placeholder="API Key (gsk_...)"
        />
      </CollapsibleSection>

      {/* Groq API Keys (texto) Section */}
      <CollapsibleSection
        title="Claves API para procesado de texto"
        description="Administra las claves usadas para el procesado de texto (resúmenes, correcciones y análisis)."
        icon={<Braces className="text-brand-500" />}
      >
        <ApiKeysSection
          keys={textKeys}
          newAlias={newTextKeyAlias}
          setNewAlias={setNewTextKeyAlias}
          newValue={newTextKeyValue}
          setNewValue={setNewTextKeyValue}
          onAdd={handleAddTextKey}
          onActivate={handleActivateTextKey}
          onDelete={(k) => confirmDeleteKey(k, 'text')}
          emptyText="No hay claves registradas. Agrega una para poder usar el procesado de texto."
          placeholder="API Key (gsk_...)"
        />
      </CollapsibleSection>

      {/* Templates Section */}
      <CollapsibleSection
        title="Plantillas de Nombre"
        description="Define prefijos para tus grabaciones. Se usarán al guardar para organizar tus archivos automáticamente."
        icon={<LayoutTemplate className="text-brand-500" />}
      >
        <div className="glass-card p-6 space-y-6">
          <div className="flex flex-wrap gap-2">
            {templates.map((t, i) => (
              <div key={i} className="glass bg-white/5 px-4 py-2 rounded-xl flex items-center gap-2 group border-brand-500/20">
                <span className="text-sm text-white font-medium">{t}</span>
                <button
                  onClick={() => handleOpenEditTemplate(i, t)}
                  className="text-zinc-500 hover:text-brand-400 transition-colors"
                  title="Editar plantilla"
                >
                  <Edit2 size={14} />
                </button>
                <button onClick={() => confirmDeleteTemplate(t)} className="text-zinc-500 hover:text-red-500 transition-colors" title="Eliminar plantilla">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-4">
             <input 
              type="text" 
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              placeholder="Nueva Plantilla" 
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors"
              onKeyDown={(e) => e.key === 'Enter' ? handleAddTemplate() : null}
            />
            <button onClick={handleAddTemplate} className="px-4 py-2 border border-dashed border-white/20 rounded-xl text-zinc-500 hover:border-brand-500/50 hover:text-brand-500 transition-all flex items-center gap-2 text-sm font-medium">
              <Plus size={16} /> Agregar
            </button>
          </div>
        </div>
      </CollapsibleSection>

      {/* Prompt Templates Section */}
      <CollapsibleSection
        title="Plantillas de Prompts"
        description="Instrucciones para modelos de IA. Se usarán en el procesado de texto y otras funcionalidades futuras."
        icon={<MessageSquareText className="text-brand-500" />}
      >
        <div className="glass-card divide-y divide-white/5">
          {promptTemplates.map((p, i) => (
            <div key={p.id} className="p-6 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-semibold text-white">{p.name}</p>
                <p className="text-xs text-zinc-500 mt-1 whitespace-pre-wrap line-clamp-3 break-words">{p.text}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => handleViewPrompt(p)} className="p-2 hover:bg-white/5 text-zinc-500 hover:text-brand-400 rounded-lg transition-all" title="Ver prompt">
                  <Eye size={18} />
                </button>
                <button onClick={() => handleOpenEditPrompt(p)} className="p-2 hover:bg-white/5 text-zinc-500 hover:text-brand-400 rounded-lg transition-all" title="Editar prompt">
                  <Edit2 size={18} />
                </button>
                <button onClick={() => confirmDeletePrompt(p)} className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all" title="Eliminar prompt">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {promptTemplates.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-sm">
              No hay plantillas de prompts registradas. Agrega una para usarla en el procesado de texto.
            </div>
          ) : null}

          <div className="p-6">
            <button onClick={handleOpenNewPrompt} className="w-full px-4 py-3 border border-dashed border-white/20 rounded-xl text-zinc-500 hover:border-brand-500/50 hover:text-brand-500 transition-all flex items-center justify-center gap-2 text-sm font-medium">
              <Plus size={16} /> Nueva Plantilla de Prompt
            </button>
          </div>
        </div>
      </CollapsibleSection>
    </div>
  )
}
