import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { FullPageSkeleton } from './FullPageSkeleton';

type Props = { role?: 'candidate' | 'employer' };

export function AuthGuard({ role }: Props): JSX.Element {
  const { user, bootstrapped, token } = useAuth();
  const location = useLocation();

  if (!bootstrapped) {
    return <FullPageSkeleton />;
  }

  if (!token || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (role && user.role !== role) {
    return <Navigate to={user.role === 'employer' ? '/employer/dashboard' : '/candidate/dashboard'} replace />;
  }

  return <Outlet />;
}
