import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const ROLE_PATHS = { master: '/master', superadmin: '/superadmin', admin: '/admin', operator_special: '/operator', operator_regular: '/operator', officer: '/officer' };

export default function NotFoundPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950">
      <div className="text-center">
        <p className="text-8xl font-black text-primary-200 dark:text-primary-900">404</p>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Page not found</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-2 mb-6">The page you're looking for doesn't exist.</p>
        <Link to={user ? ROLE_PATHS[user.role] : '/login'} className="btn-primary">
          {user ? 'Go to Dashboard' : 'Go to Login'}
        </Link>
      </div>
    </div>
  );
}
