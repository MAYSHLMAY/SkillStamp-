import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';

export function AppLayout(): JSX.Element {
  return (
    <>
      <Navbar />
      <Outlet />
    </>
  );
}
