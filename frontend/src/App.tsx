// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Landing from "./pages/Landing";
import AppPage from "./pages/App";
import { useAuth } from "./context/AuthProvider";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/app" element={<RequireAuth><AppPage /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
