import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import App from './App.jsx'
import DrumMachine from './DrumMachine.jsx'
import Home from './home.jsx'
import AnimatedPage from './AnimatedPage.jsx'

function AppRouter() {
  const location = useLocation()
  
  return (
    <div style={{ position: 'relative', minHeight: '100vh' }}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" 
          element={<AnimatedPage> 
            <App />
              </AnimatedPage>
            } 
            />
          <Route 
            path="/DrumMachine" 
            element={
              <AnimatedPage>
                <DrumMachine />
              </AnimatedPage>
            } 
          />
          <Route 
            path="/home" 
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
    <BrowserRouter basename="/app">
      <AppRouter />
    </BrowserRouter>
  </StrictMode>
)