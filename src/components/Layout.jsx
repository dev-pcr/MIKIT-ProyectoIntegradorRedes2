import { Outlet, NavLink, useLocation } from 'react-router-dom'
import { Home, Mic, FileText, Settings, Menu, X, ChevronRight, Activity } from 'lucide-react'
import { useState, useEffect } from 'react'
import { checkBackendStatus } from '../utils/api'
import { motion, AnimatePresence } from 'framer-motion'
import { clsx } from 'clsx'

const navItems = [
  { path: '/', icon: Home, label: 'Inicio' },
  { path: '/grabadora', icon: Mic, label: 'Grabadora' },
  { path: '/transcriptor', icon: FileText, label: 'Transcriptor' },
  { path: '/configuracion', icon: Settings, label: 'Configuración' },
]

export default function Layout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [isBackendOnline, setIsBackendOnline] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const checkStatus = async () => {
      const online = await checkBackendStatus()
      setIsBackendOnline(online)
    }
    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex min-h-screen relative overflow-hidden">
      {/* Mesh Background */}
      <div className="bg-mesh">
        <div className="mesh-circle w-[600px] h-[600px] bg-brand-900/20 top-[-10%] left-[-10%]" />
        <div className="mesh-circle w-[500px] h-[500px] bg-blue-900/20 bottom-[-10%] right-[-10%]" />
        <div className="mesh-circle w-[400px] h-[400px] bg-indigo-900/10 top-[40%] right-[20%]" />
      </div>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 80 }}
        className="glass border-r border-white/5 h-screen sticky top-0 z-50 flex flex-col transition-all duration-300"
      >
        <div className="p-6 flex items-center justify-between">
          <AnimatePresence mode="wait">
            {isSidebarOpen ? (
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center shadow-lg shadow-brand-600/20">
                  <img src="/LOGO.png" alt="MIKIT Logo" className="w-full h-full object-cover" />
                </div>
                <h1 className="font-display font-bold text-xl tracking-tight text-white">MIKIT</h1>
              </motion.div>
            ) : null}
          </AnimatePresence>
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) => clsx(
                "flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-300 group relative",
                isActive 
                  ? "bg-brand-600/10 text-brand-400" 
                  : "text-zinc-500 hover:bg-white/5 hover:text-zinc-200"
              )}
            >
              <item.icon size={22} className={clsx(
                "transition-transform duration-300 group-hover:scale-110",
                location.pathname === item.path && "text-brand-500"
              )} />
              {isSidebarOpen ? (
                <span className="font-medium whitespace-nowrap">{item.label}</span>
              ) : null}
              {location.pathname === item.path ? (
                <motion.div 
                  layoutId="active-nav"
                  className="absolute left-0 w-1 h-6 bg-brand-500 rounded-full"
                />
              ) : null}
            </NavLink>
          ))}
        </nav>

        {/* Status Indicator */}
        <div className="p-6 border-t border-white/5 mt-auto">
          <div className="flex items-center gap-3">
            <div className={clsx(
              "w-2 h-2 rounded-full transition-all duration-500",
              isBackendOnline ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
            )} />
            {isSidebarOpen ? (
              <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.15em] whitespace-nowrap">
                Server: {isBackendOnline ? <span className="text-green-500">Online</span> : <span className="text-red-500">Offline</span>}
              </span>
            ) : null}
          </div>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen flex flex-col p-8 overflow-y-auto">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="max-w-6xl mx-auto w-full"
        >
          <Outlet />
        </motion.div>
      </main>
    </div>
  )
}
