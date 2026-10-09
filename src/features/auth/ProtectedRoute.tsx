import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { logout } from "../../services/authService";

export function ProtectedRoute({ requireRole }: { requireRole?: string }) {
  const { user, account, loading } = useAuth();

  if (loading) return <div className="p-10 text-center">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (account?.banned)
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <h1 className="text-xl font-bold text-red-600">Account suspended</h1>
        <p className="mt-2 text-gray-600">This account was suspended for breaking our rules.</p>
        <button onClick={logout} className="mt-4 rounded bg-neutral-800 px-4 py-2 text-white">Log out</button>
      </div>
    );
  if (requireRole && account?.role !== requireRole) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
