import { useEffect, useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import './Navbar.css';

const socketUrl = import.meta.env.VITE_SOCKET_URL ?? '';

export function Navbar(): JSX.Element {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [online, setOnline] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [ddOpen, setDdOpen] = useState(false);

  useEffect(() => {
    const s: Socket = io(socketUrl || undefined, { transports: ['websocket', 'polling'] });
    s.on('online:count', (n: number) => setOnline(n));
    if (user) {
      s.emit('user:connect', { userId: user.id, role: user.role });
    }
    return () => {
      s.disconnect();
    };
  }, [user]);

  const publicLinks = (
    <>
      <NavLink className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`} to="/jobs" end>
        Browse Jobs
      </NavLink>
      <NavLink className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`} to="/login">
        Login
      </NavLink>
      <NavLink className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`} to="/register">
        Register
      </NavLink>
    </>
  );

  const candidateLinks = (
    <>
      <NavLink className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`} to="/jobs">
        Browse Jobs
      </NavLink>
      <NavLink
        className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
        to="/candidate/dashboard"
      >
        My Applications
      </NavLink>
      <NavLink
        className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
        to="/candidate/sessions"
      >
        My Sessions
      </NavLink>
    </>
  );

  const employerLinks = (
    <>
      <NavLink
        className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
        to="/employer/dashboard"
      >
        Dashboard
      </NavLink>
      <NavLink
        className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
        to="/employer/jobs/new"
      >
        Post a Job
      </NavLink>
      <NavLink
        className={({ isActive }) => `nav__link ${isActive ? 'nav__link--active' : ''}`}
        to="/employer/sessions"
      >
        My Sessions
      </NavLink>
    </>
  );

  const center = !user ? publicLinks : user.role === 'candidate' ? candidateLinks : employerLinks;

  return (
    <header className="nav">
      <div className="nav__inner">
        <button type="button" className="nav__burger" aria-label="Open menu" onClick={() => setMenuOpen(true)}>
          ☰
        </button>

        <Link to={user ? (user.role === 'employer' ? '/employer/dashboard' : '/candidate/dashboard') : '/jobs'} className="nav__brand">
          <span className="nav__dot" />
          <span className="nav__word">SkillStamp</span>
        </Link>

        <nav className="nav__center">{center}</nav>

        <div className="nav__right">
          <div className="nav__online" title="Live connections">
            <span className="nav__pulse" />
            <span className="nav__onlineText">{online} online</span>
          </div>
          <button type="button" className="nav__icon" aria-label="Notifications">
            🔔
          </button>
          {user ? (
            <div className="nav__profile">
              <button
                type="button"
                className="nav__avatar"
                onClick={() => setDdOpen((v) => !v)}
                aria-expanded={ddOpen}
              >
                {user.name.slice(0, 1).toUpperCase()}
              </button>
              {ddOpen ? (
                <div className="nav__dropdown">
                  <div className="nav__dropdownName">{user.name}</div>
                  <button
                    type="button"
                    className="nav__dropdownBtn"
                    onClick={() => {
                      setDdOpen(false);
                      logout();
                      navigate('/login');
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {menuOpen ? (
        <div className="nav__drawerOverlay" onClick={() => setMenuOpen(false)}>
          <aside className="nav__drawer" onClick={(e) => e.stopPropagation()}>
            <div className="nav__drawerHead">
              <span className="nav__word">Menu</span>
              <button type="button" className="nav__ghost" onClick={() => setMenuOpen(false)}>
                Close
              </button>
            </div>
            <div className="nav__drawerLinks" onClick={() => setMenuOpen(false)}>
              {!user ? publicLinks : user.role === 'candidate' ? candidateLinks : employerLinks}
            </div>
          </aside>
        </div>
      ) : null}
    </header>
  );
}
