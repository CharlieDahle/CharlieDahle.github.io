// src/main.jsx - Enhanced with WebSocket initialization
import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import "bootstrap/dist/css/bootstrap.min.css";
import {
  BrowserRouter,
  Routes,
  Route,
  useLocation,
  Navigate,
} from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import App from "./App.jsx";
import DrumMachineApp from "./components/DrumMachineApp/DrumMachineApp.jsx";
import Home from "./pages/Home/Home.jsx";
import AnimatedPage from "./AnimatedPage.jsx";
import { useAppStore } from "./stores";
import "./styles/index.css";

// Import the auth pages
import Login from "./pages/Login/Login.jsx";
import Beats from "./pages/Beats/Beats.jsx";

// App initialization component - handles both auth AND websocket
function AppInitializer({ children }) {
  const initializeAuth = useAppStore((state) => state.auth.initializeAuth);
  const initializeConnection = useAppStore(
    (state) => state.websocket.initializeConnection
  );
  const cleanup = useAppStore((state) => state.websocket.cleanup);

  useEffect(() => {
    // Initialize auth state from localStorage on app start
    initializeAuth();

    // Initialize WebSocket connection on app start
    console.log("🔌 Initializing WebSocket connection from main.jsx");
    initializeConnection();

    // Cleanup on unmount
    return () => {
      console.log("🔌 Cleaning up WebSocket connection from main.jsx");
      cleanup();
    };
  }, [initializeAuth, initializeConnection, cleanup]);

  return children;
}

// Protected route component
function ProtectedRoute({ children, requireAuth = true }) {
  const isAuthenticated = useAppStore((state) => state.auth.isAuthenticated);
  const location = useLocation();

  if (requireAuth && !isAuthenticated) {
    // Redirect to login page with return path
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!requireAuth && isAuthenticated) {
    // If user is authenticated and tries to access login, redirect to beats
    return <Navigate to="/beats" replace />;
  }

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
            path="/DrumMachine/:roomId?"
            element={
              <AnimatedPage>
                <DrumMachineApp />
              </AnimatedPage>
            }
          />

          <Route
            path="/login"
            element={
              <ProtectedRoute requireAuth={false}>
                <AnimatedPage>
                  <Login />
                </AnimatedPage>
              </ProtectedRoute>
            }
          />

          <Route
            path="/beats"
            element={
              <ProtectedRoute requireAuth={true}>
                <AnimatedPage>
                  <Beats />
                </AnimatedPage>
              </ProtectedRoute>
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
      <AppInitializer>
        <AppRouter />
      </AppInitializer>
    </BrowserRouter>
  </StrictMode>
);
