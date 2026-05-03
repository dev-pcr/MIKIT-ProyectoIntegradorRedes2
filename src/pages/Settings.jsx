import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Key, Plus, Trash2, ShieldCheck, LayoutTemplate, AlertCircle, Check } from 'lucide-react'
import { getApiKeys, saveApiKeys, getTemplates, saveTemplates } from '../utils/preferences'

export default function Settings() {
  const [keys, setKeys] = useState([])
  const [templates, setTemplates] = useState([])
  
  const [newKeyAlias, setNewKeyAlias] = useState('')
  const [newKeyValue, setNewKeyValue] = useState('')
  const [newTemplate, setNewTemplate] = useState('')

  // UI States (Alerts & Confirmations)
  const [toasts, setToasts] = useState([])
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [itemToDelete, setItemToDelete] = useState(null)

  useEffect(() => {
    setKeys(getApiKeys())
    setTemplates(getTemplates())
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
    addToast('Clave API agregada exitosamente', 'success')
  }

  const confirmDeleteKey = (k) => {
    setItemToDelete({ type: 'key', data: k })
    setDeleteModalOpen(true)
  }

  const confirmDeleteTemplate = (t) => {
    setItemToDelete({ type: 'template', data: t })
    setDeleteModalOpen(true)
  }

  const executeDelete = () => {
    if (!itemToDelete) return

    if (itemToDelete.type === 'key') {
      const id = itemToDelete.data.id
      setKeys(prevKeys => {
        const updatedKeys = prevKeys.filter(k => k.id !== id)
        if (updatedKeys.length > 0 && !updatedKeys.some(k => k.active)) {
          updatedKeys[0].active = true
        }
        saveApiKeys(updatedKeys)
        return updatedKeys
      })
      addToast('Clave API eliminada', 'error')
    } else if (itemToDelete.type === 'template') {
      const templateToDelete = itemToDelete.data
      setTemplates(prevTemplates => {
        const updatedTemplates = prevTemplates.filter(t => t !== templateToDelete)
        saveTemplates(updatedTemplates)
        return updatedTemplates
      })
      addToast('Plantilla eliminada', 'error')
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
    addToast('Clave API activada', 'success')
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

  const maskKey = (keyString) => {
    if (keyString.length <= 8) return '********';
    return `${keyString.slice(0, 4)}...${keyString.slice(-4)}`;
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
                  ¿Estás seguro de que quieres eliminar {itemToDelete?.type === 'key' ? 'la clave' : 'la plantilla'} <span className="text-white font-medium">"{itemToDelete?.type === 'key' ? itemToDelete.data.alias : itemToDelete?.data}"</span>?
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
      <section className="space-y-6">
        <div className="flex items-center gap-3 text-white">
          <Key className="text-brand-500" />
          <h3 className="text-xl font-bold">Claves API de Groq</h3>
        </div>
        
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
                  <p className="text-xs font-mono text-zinc-500">{maskKey(k.key)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!k.active ? (
                  <button onClick={() => handleActivateKey(k.id)} className="px-3 py-1.5 text-xs font-medium glass hover:bg-white/10 rounded-lg transition-all text-white">
                    Activar
                  </button>
                ) : null}
                <button onClick={() => confirmDeleteKey(k)} className="p-2 hover:bg-red-500/10 text-zinc-500 hover:text-red-500 rounded-lg transition-all">
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
          ))}

          {keys.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-sm">
              No hay claves registradas. Agrega una para poder usar el transcriptor.
            </div>
          ) : null}

          <div className="p-6 flex gap-3">
            <input 
              type="text" 
              value={newKeyAlias}
              onChange={(e) => setNewKeyAlias(e.target.value)}
              placeholder="Alias (ej. Mi Clave)" 
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors"
            />
            <input 
              type="password" 
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="API Key (gsk_...)" 
              className="flex-[2] bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-brand-500/50 transition-colors"
            />
            <button onClick={handleAddKey} className="btn-primary py-2 px-4 whitespace-nowrap">
              <Plus size={18} /> Agregar
            </button>
          </div>
        </div>
      </section>

      {/* Templates Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-3 text-white">
          <LayoutTemplate className="text-brand-500" />
          <h3 className="text-xl font-bold">Plantillas de Nombre</h3>
        </div>

        <div className="glass-card p-6 space-y-6">
          <p className="text-sm text-zinc-500">
            Define prefijos para tus grabaciones. Se usarán al guardar para organizar tus archivos automáticamente.
          </p>

          <div className="flex flex-wrap gap-2">
            {templates.map((t, i) => (
              <div key={i} className="glass bg-white/5 px-4 py-2 rounded-xl flex items-center gap-2 group border-brand-500/20">
                <span className="text-sm text-white font-medium">{t}</span>
                <button onClick={() => confirmDeleteTemplate(t)} className="text-zinc-500 hover:text-red-500 transition-colors">
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
      </section>
    </div>
  )
}
