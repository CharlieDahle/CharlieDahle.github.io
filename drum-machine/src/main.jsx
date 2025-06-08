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
            <Home />  {/* Blob stack homepage! */}
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

// GitHub Pages SPA redirect handler
if (typeof window !== 'undefined') {
  const l = window.location;
  if (l.search[1] === '/') {
    var decoded = l.search.slice(1).split('&').map(function(s) { 
      return s.replace(/~and~/g, '&')
    }).join('?');
    window.history.replaceState(null, null,
        l.pathname.slice(0, -1) + decoded + l.hash
    );
  }
}