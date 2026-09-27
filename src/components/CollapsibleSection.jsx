import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

/**
 * Sección plegable con encabezado clickeable y altura animada.
 *
 * Se usa en Configuración y en la Grabadora ("Configuración adicional") para
 * agrupar herramientas secundarias sin recargar la pantalla.
 *
 * @param {string} title       Título visible del encabezado.
 * @param {string} [description] Bajada opcional, en texto chico.
 * @param {React.ReactNode} [icon] Ícono a la izquierda del título.
 * @param {boolean} [defaultOpen] Estado inicial (por defecto, plegado).
 * @param {React.ReactNode} children Contenido que se revela al desplegar.
 */
export default function CollapsibleSection({ title, description, icon, defaultOpen = false, children }) {
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
