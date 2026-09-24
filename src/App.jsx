import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Recorder from './pages/Recorder'
import Transcriber from './pages/Transcriber'
import History from './pages/History'
import Settings from './pages/Settings'
import AIProcessor from './pages/AIProcessor'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="grabadora" element={<Recorder />} />
        <Route path="transcriptor" element={<Transcriber />} />
        <Route path="historial" element={<History />} />
        <Route path="procesar-ia" element={<AIProcessor />} />
        <Route path="configuracion" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
