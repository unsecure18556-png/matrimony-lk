import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "../features/auth/AuthContext";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import LoginPage from "../features/auth/LoginPage";
import RegisterPage from "../features/auth/RegisterPage";
import ForgotPasswordPage from "../features/auth/ForgotPasswordPage";
import ResetPasswordPage from "../features/auth/ResetPasswordPage";
import VerifyEmailPage from "../features/auth/VerifyEmailPage";
import Layout from "../components/Layout";
import HomePage from "../features/dashboard/HomePage";
import OnboardingPage from "../features/onboarding/OnboardingPage";
import SearchPage from "../features/search/SearchPage";
import MatchesPage from "../features/matches/MatchesPage";
import ProfileViewPage from "../features/profile/ProfileViewPage";
import InterestsPage from "../features/interests/InterestsPage";
import MessagesPage from "../features/messages/MessagesPage";
import FaceVerifyPage from "../features/face/FaceVerifyPage";
import SettingsPage from "../features/settings/SettingsPage";
import AdminPage from "../features/admin/AdminPage";
import MorePage from "../features/more/MorePage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/onboarding" element={<OnboardingPage />} />
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<HomePage />} />
              <Route path="/search" element={<SearchPage />} />
              <Route path="/matches" element={<MatchesPage />} />
              <Route path="/interests" element={<InterestsPage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/messages/:otherId" element={<MessagesPage />} />
              <Route path="/p/:id" element={<ProfileViewPage />} />
              <Route path="/profile" element={<Navigate to="/p/me" replace />} />
              <Route path="/verify-face" element={<FaceVerifyPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/more" element={<MorePage />} />
              <Route element={<ProtectedRoute requireRole="admin" />}>
                <Route path="/admin" element={<AdminPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
