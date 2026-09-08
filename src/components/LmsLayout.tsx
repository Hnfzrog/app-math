'use client';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface LmsLayoutProps {
  children: React.ReactNode;
  role: 'admin' | 'guru' | 'siswa';
  userName?: string;
  pageTitle?: string;
}

export default function LmsLayout({ children, role, userName = "Pengguna", pageTitle = "Dashboard" }: LmsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();

  const toggleSidebar = (state?: boolean) => {
    if (typeof state === 'boolean') {
      setSidebarOpen(state);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  const getNavLinks = () => {
    if (role === 'admin') {
      return [
        { name: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
        { name: 'Kelola User', href: '/admin/users', icon: '👥' },
        { name: 'Master Kelas', href: '/admin/kelas', icon: '🏫' },
      ];
    } else if (role === 'guru') {
      return [
        { name: 'Dashboard', href: '/guru/dashboard', icon: '📊' },
        { name: 'Kelas Saya', href: '/guru/kelas', icon: '🏫' },
        { name: 'Presensi', href: '/guru/presensi', icon: '📋' },
        { name: 'Penilaian', href: '/guru/penilaian', icon: '✍️' },
      ];
    } else {
      return [
        { name: 'Dashboard', href: '/siswa/dashboard', icon: '📊' },
        { name: 'Kelas Saya', href: '/siswa/kelas', icon: '🏫' },
        { name: 'Profil Saya', href: '/siswa/profile', icon: '👤' },
        { name: 'Materi Belajar', href: '/siswa/materi', icon: '📚' },
        { name: 'Tugas & Kuis', href: '/siswa/tugas', icon: '📝' },
        { name: 'Nilai Saya', href: '/siswa/nilai', icon: '🏆' },
      ];
    }
  };

  return (
    <div className="dashboard-shell">
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'show' : ''}`}>
        <div className="sidebar-brand">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
          <span>EduSchool LMS</span>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">{userName.substring(0, 2).toUpperCase()}</div>
          <div className="user-details">
            <span className="user-name">{userName}</span>
            <span className="user-role-badge">{role}</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          {getNavLinks().map((link) => (
            <Link 
              key={link.href} 
              href={link.href} 
              className={`nav-link ${pathname === link.href ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span style={{ fontSize: '18px' }}>{link.icon}</span>
              <span>{link.name}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Link href="/login" className="btn-logout">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>Keluar Sesi</span>
          </Link>
        </div>
      </aside>

      {/* OVERLAY FOR MOBILE SIDEBAR */}
      <div 
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} 
        onClick={() => toggleSidebar(false)}
      ></div>

      {/* MAIN LAYOUT RIGHT */}
      <div className="main-content-wrapper">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="topbar-left">
            <button type="button" className="btn-toggle-sidebar btn-icon" onClick={() => toggleSidebar()}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
            <div>
              <h2>{pageTitle}</h2>
              <div className="breadcrumb">EduSchool / {role} / {pageTitle}</div>
            </div>
          </div>

          <div className="topbar-right">
            <div className="topbar-user-info">
              <span>{userName}</span>
              <span className="badge badge-primary">{role}</span>
            </div>
          </div>
        </header>

        {/* MAIN VIEW CONTAINER */}
        <main className="main-body">
          {children}
        </main>
      </div>
    </div>
  );
}
