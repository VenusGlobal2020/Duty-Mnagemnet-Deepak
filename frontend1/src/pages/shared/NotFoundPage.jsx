import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_PATHS = { master: '/master', superadmin: '/superadmin', admin: '/admin', operator_special: '/operator', operator_regular: '/operator', officer: '/officer' };

export default function NotFoundPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-50 dark:bg-ink-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-aurora opacity-70 dark:opacity-30" />
      <div className="absolute -top-32 -left-20 w-[34rem] h-[34rem] rounded-full bg-signal2-300/20 blur-3xl" />
      <div className="relative text-center px-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-signal-500 to-signal-700 flex items-center justify-center mx-auto mb-4 shadow-glow-signal">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <p className="text-8xl font-display font-black bg-gradient-to-br from-signal-500 to-signal2-500 bg-clip-text text-transparent">404</p>
        <h1 className="text-2xl font-display font-bold text-ink-900 dark:text-white mt-2">Page not found</h1>
        <p className="text-ink-500 dark:text-ink-400 mt-2 mb-6">The page you're looking for doesn't exist.</p>
        <Link to={user ? ROLE_PATHS[user.role] : '/login'} className="btn-primary">
          {user ? 'Go to Dashboard' : 'Go to Login'}
        </Link>
      </div>
    </div>
  );
}
