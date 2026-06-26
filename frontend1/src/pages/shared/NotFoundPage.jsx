import { Link } from 'react-router-dom';
import { Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_PATHS = { master: '/master', superadmin: '/superadmin', admin: '/admin', operator_special: '/operator', operator_regular: '/operator', officer: '/officer' };

export default function NotFoundPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-ink-950 relative overflow-hidden">
      <div className="absolute inset-0 grid-backdrop opacity-50" />
      <div className="absolute -top-32 -left-20 w-[34rem] h-[34rem] rounded-full bg-signal2-500/10 blur-3xl" />
      <div className="relative text-center">
        <Shield className="w-10 h-10 mx-auto text-signal-400 mb-3" />
        <p className="text-8xl font-display font-black text-signal2-400/20">404</p>
        <h1 className="text-2xl font-display font-bold text-white mt-2">Page not found</h1>
        <p className="text-ink-400 mt-2 mb-6">The page you're looking for doesn't exist.</p>
        <Link to={user ? ROLE_PATHS[user.role] : '/login'} className="btn-primary">
          {user ? 'Go to Dashboard' : 'Go to Login'}
        </Link>
      </div>
    </div>
  );
}
