import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Recorder from './pages/Recorder'
import Transcriber from './pages/Transcriber'
import Settings from './pages/Settings'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="grabadora" element={<Recorder />} />
        <Route path="transcriptor" element={<Transcriber />} />
        <Route path="configuracion" element={<Settings />} />
      </Route>
    </Routes>
  )
}

export default App
