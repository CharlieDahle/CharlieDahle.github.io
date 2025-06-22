import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import App from './App.jsx'
import DrumMachineApp from './components/DrumMachineApp/DrumMachineApp.jsx'
import Home from './pages/Home/Home.jsx'
import AnimatedPage from './AnimatedPage.jsx'
import './styles/index.css'

function AppRouter() {
  const location = useLocation()
  
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" 
          element={<AnimatedPage> 
            <Home />  {/* Blob stack homepage! */}
              </AnimatedPage>
            } 
            />
          <Route 
            path="/DrumMachine" 
            element={
              <AnimatedPage>
                <DrumMachineApp /> {/* Changed from DrumMachine */}
              </AnimatedPage>
            } 
          />
          <Route 
            path="/terminal" 
            element={
              <AnimatedPage>
                <App />
              </AnimatedPage>
            } 
          />
          {/* Catch-all route */}
          <Route 
            path="*" 
            element={
              <AnimatedPage>
                <Home />
              </AnimatedPage>
            } 
          />
        </Routes>
      </AnimatePresence>
    </div>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>
)