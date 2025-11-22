// src/App.tsx
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Landing from "./pages/Landing";
import AppPage from "./pages/App";
import { useAuth } from "./context/AuthProvider";
import Register from "./pages/Register";
import RegisterOrg from "./pages/RegisterOrg";
import RequireVerified from "./components/RequireVerified";
import Verify from "./pages/Verify";
import NewEvent from "./pages/NewEvent";
import UserProfilePage from "./pages/UserProfile";
import CalendarRoute from "./pages/CalendarRoute";
import HandleAuthActionPage from "./pages/HandleAuthActionPage"; 
import ResetPasswordPage from "./pages/ResetPasswordPage"; 
import { useState, type JSX } from "react";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const { user } = useAuth(); // <-- NEW: Access the user object here
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const handleDateSelection = (date: Date): void => {
    setSelectedDate(date);
  };

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/handle-auth-action" element={<HandleAuthActionPage />} /> 
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      
      {/* AUTHENTICATED ROUTES */}
      <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
      <Route path="/app" element={<RequireAuth><RequireVerified><AppPage /></RequireVerified></RequireAuth>} />
      <Route path="/events/new" element={<RequireAuth><NewEvent /></RequireAuth>} />
      <Route path="/u/:uid" element={<RequireAuth><UserProfilePage /></RequireAuth>} />
      
      {/* CALENDAR ROUTE */}
      <Route path="/calendar" element={
        <RequireAuth>
          <CalendarRoute
            currentDate={currentDate}
            setCurrentDate={setCurrentDate}
            onDateSelect={handleDateSelection} 
            currentUser={user!} 
          />
        </RequireAuth>
      } />

      <Route path="/register" element={<Register />} />
      <Route path="/registerOrg" element={<RegisterOrg />} />
      <Route path="/verify" element={<Verify />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
