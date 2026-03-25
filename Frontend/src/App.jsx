import { Menu } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useOutletContext,
} from "react-router-dom";

import Sidebar from "./components/Sidebar";
import ProfileSettingsDrawer from "./components/ProfileSettingsDrawer";
import ToastViewport from "./components/ToastViewport";
import { AuthProvider } from "./context/AuthContext";
import { MetalsProvider } from "./context/MetalsContext";
import { useAuth } from "./hooks/useAuth";
import AuthPage from "./pages/AuthPage";
import AdvancedFeatures from "./pages/AdvancedFeatures/AdvancedFeatures";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import MetalDetailPage from "./pages/MetalDetailPage";
import MetalsPage from "./pages/MetalsPage";
import PortfolioView from "./pages/PortfolioView";
import StockDetail from "./pages/StockDetail";

function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm uppercase tracking-widest text-muted">
        Loading terminal...
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

function ProtectedLayout({ onToast }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);
  const outletContext = useMemo(() => ({ onToast }), [onToast]);

  const handleLogout = async () => {
    await logout();
    onToast({ type: "success", message: "Logged out successfully." });
    navigate("/login");
  };

  return (
    <div className="app-shell bg-base">
      <div className="flex min-h-screen">
        <Sidebar user={user} onLogout={handleLogout} onOpenProfile={() => setProfileSettingsOpen(true)} />

        <div className="flex min-h-screen flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-base/95 px-4 py-4 backdrop-blur lg:hidden">
            <div>
              <p className="text-xs uppercase tracking-widest text-muted">AI StockAnalysis</p>
              <p className="font-display text-xl text-text">Terminal</p>
            </div>
            <button
              type="button"
              onClick={() => setMobileNavOpen((value) => !value)}
              className="rounded-panel border border-border p-2 text-text"
            >
              <Menu size={20} />
            </button>
          </header>

          {mobileNavOpen ? (
            <div className="lg:hidden">
              <Sidebar user={user} onLogout={handleLogout} onOpenProfile={() => setProfileSettingsOpen(true)} mobile />
            </div>
          ) : null}

          <main className="animate-routeFade px-4 py-5 lg:px-8 lg:py-8">
            <Outlet context={outletContext} />
          </main>

          <ProfileSettingsDrawer
            open={profileSettingsOpen}
            onClose={() => setProfileSettingsOpen(false)}
            onToast={onToast}
          />
        </div>
      </div>
    </div>
  );
}

function AppRoutes({ onToast }) {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [location.pathname]);

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<AuthPage onToast={onToast} />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<ProtectedLayout onToast={onToast} />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/portfolios" element={<Dashboard />} />
          <Route path="/metals" element={<MetalsPage />} />
          <Route path="/metals/:metal" element={<MetalDetailPage />} />
          <Route path="/portfolio/:id" element={<PortfolioView />} />
          <Route path="/stock/:pk" element={<StockDetail />} />
          <Route path="/advanced/:ticker" element={<AdvancedFeatures />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function AppInner() {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <BrowserRouter>
        <MetalsProvider>
          <AppRoutes onToast={setToast} />
        </MetalsProvider>
      </BrowserRouter>
      <ToastViewport toast={toast} onClose={() => setToast(null)} />
    </>
  );
}

export function useAppToast() {
  return useOutletContext();
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
