// src/main.jsx - Updated with auth routes and initialization
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import "bootstrap/dist/css/bootstrap.min.css";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import App from "./App.jsx";
import DrumMachineApp from "./components/DrumMachineApp/DrumMachineApp.jsx";
import Home from "./pages/Home/Home.jsx";
import AnimatedPage from "./AnimatedPage.jsx";
import { useAppStore } from "./stores";
import "./styles/index.css";

// Import the new auth pages
import Login from "./pages/Login/Login.jsx";
import Beats from "./pages/Beats/Beats.jsx";

// Auth initialization component
function AuthInitializer({ children }) {
  const initializeAuth = useAppStore((state) => state.auth.initializeAuth);

  useEffect(() => {
    // Initialize auth state from localStorage on app start
    initializeAuth();
  }, [initializeAuth]);

  return children;
}

function AppRouter() {
  const location = useLocation();

  return (
    <div style={{ position: "relative", minHeight: "100vh" }}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route
            path="/"
            element={
              <AnimatedPage>
                <Home /> {/* Blob stack homepage! */}
              </AnimatedPage>
            }
          />
          <Route
            path="/DrumMachine"
            element={
              <AnimatedPage>
                <DrumMachineApp />
              </AnimatedPage>
            }
          />
          <Route
            path="/login"
            element={
              <AnimatedPage>
                <Login />
              </AnimatedPage>
            }
          />
          <Route
            path="/beats"
            element={
              <AnimatedPage>
                <Beats />
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
          {/* Catch-all route - this is important for GitHub Pages */}
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
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthInitializer>
        <AppRouter />
      </AuthInitializer>
    </BrowserRouter>
  </StrictMode>
);
