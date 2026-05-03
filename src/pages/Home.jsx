import { motion } from 'framer-motion'
import { Mic, FileText, ChevronRight, Clock, Shield, Zap } from 'lucide-react'
import { Link } from 'react-router-dom'

const cards = [
  {
    title: 'Grabadora Pro',
    description: 'Captura audio con alta fidelidad, gestión de plantillas y almacenamiento local seguro.',
    icon: Mic,
    path: '/grabadora',
    color: 'from-red-500/20 to-orange-500/20',
    iconColor: 'text-red-500'
  },
  {
    title: 'Transcriptor IA',
    description: 'Convierte tus archivos de audio y video en texto usando modelos avanzados de IA.',
    icon: FileText,
    path: '/transcriptor',
    color: 'from-blue-500/20 to-brand-500/20',
    iconColor: 'text-blue-500'
  }
]

export default function Home() {
  return (
    <div className="space-y-12">
      <header className="space-y-4">
        <motion.h2 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="text-4xl font-display font-bold text-white tracking-tight"
        >
          Bienvenido a <span className="text-brand-500">MIKIT</span>
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-zinc-400 text-lg max-w-2xl"
        >
          Tu centro de productividad para gestión tareas inteligentes. Todo en un solo lugar.
        </motion.p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {cards.map((card, index) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 + 0.2 }}
          >
            <Link 
              to={card.path}
              className="group block relative p-8 glass-card overflow-hidden"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${card.color} opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
              
              <div className="relative z-10 space-y-6">
                <div className={`w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center ${card.iconColor} group-hover:scale-110 transition-transform duration-500 shadow-xl border border-white/10`}>
                  <card.icon size={32} />
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-2xl font-display font-bold text-white">{card.title}</h3>
                  <p className="text-zinc-400 group-hover:text-zinc-300 transition-colors">{card.description}</p>
                </div>

                <div className="flex items-center justify-end pt-4 border-t border-white/5">
                  <div className="flex items-center gap-2 text-brand-400 font-medium group-hover:gap-4 transition-all">
                    Empezar <ChevronRight size={18} />
                  </div>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-8">
        {[
          { icon: Shield, title: 'Privacidad', desc: 'Ten todo disponible en tu propia PC. Tus datos nunca salen de tu equipo.' },
          { icon: Zap, title: 'Velocidad', desc: 'Maximiza tu ahorro de tiempo personal con automatización ultrarrápida.' },
          { icon: Clock, title: 'Historial', desc: 'Accede a tus trabajos en cualquier momento.' },
        ].map((feat, i) => (
          <motion.div 
            key={feat.title}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 + i * 0.1 }}
            className="flex items-start gap-4 p-4"
          >
            <div className="p-2 rounded-lg bg-brand-500/10 text-brand-500">
              <feat.icon size={20} />
            </div>
            <div>
              <h4 className="font-semibold text-white">{feat.title}</h4>
              <p className="text-sm text-zinc-500">{feat.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
