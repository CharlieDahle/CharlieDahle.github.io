// main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import App from './App.jsx'
import Drums from './drums.jsx'
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
            path="/drums" 
            element={
              <AnimatedPage>
                <Drums />
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
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  </StrictMode>
)