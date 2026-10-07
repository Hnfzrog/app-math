'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { fileUrl } from '@/lib/uploadClient';
import { tampilkanNotifikasi } from '@/lib/notifikasi';
import GpsGate from './GpsGate';

interface LmsLayoutProps {
  children: React.ReactNode;
  role: 'admin' | 'guru' | 'siswa';
  userName?: string;
  pageTitle?: string;
}

export default function LmsLayout({ children, role, userName: userNameProp = "Pengguna", pageTitle = "Dashboard" }: LmsLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [izinNotif, setIzinNotif] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('unsupported');
  const pathname = usePathname();
  const router = useRouter();
  const [displayName, setDisplayName] = useState(userNameProp);
  const [fotoProfil, setFotoProfil] = useState<string | null>(null);
  const [namaSekolah, setNamaSekolah] = useState('EduSchool');
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);
  const [showHelpdesk, setShowHelpdesk] = useState(false);
  const [helpdeskDeskripsi, setHelpdeskDeskripsi] = useState('');
  const [helpdeskSending, setHelpdeskSending] = useState(false);

  // Fetch nama asli dari DB berdasarkan sesi aktif
  useEffect(() => {
    const fetchName = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('users')
        .select('nama, foto_profil_url')
        .eq('id', session.user.id)
        .single();
      if (data?.nama) setDisplayName(data.nama);
      if (data?.foto_profil_url) setFotoProfil(data.foto_profil_url);
    };
    fetchName();
    window.addEventListener('focus', fetchName);
    return () => window.removeEventListener('focus', fetchName);
  }, []);

  // Nama sekolah (dari master pengaturan) — dipakai di sidebar & breadcrumb
  useEffect(() => {
    supabase.from('pengaturan').select('nama_sekolah').limit(1).single().then(({ data }) => {
      if (data?.nama_sekolah) setNamaSekolah(data.nama_sekolah);
    });
  }, []);

  // Fetch notifikasi + REALTIME: badge & daftar update tanpa reload.
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    // Nama unik per-mount: StrictMode menjalankan effect 2x; nama tetap akan
    // menabrak channel yang sudah subscribe → error "callbacks after subscribe()".
    const namaChannel = `notifikasi-user-${Math.random().toString(36).slice(2)}`;

    const fetchNotifs = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data } = await supabase
        .from('notifikasi')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        setNotifications(data);
        setUnreadNotifs(data.filter((n) => !n.is_read).length);
      }
    };

    const init = async () => {
      await fetchNotifs();
      if (!active) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || !active) return;
      // Dengarkan notifikasi baru milik user ini → tampil langsung, tanpa reload.
      channel = supabase
        .channel(namaChannel)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifikasi', filter: `user_id=eq.${session.user.id}` },
          (payload: { eventType?: string; new?: { pesan?: string } }) => {
            fetchNotifs();
            // Baris notifikasi BARU → tampilkan OS/toast DI HALAMAN MANA PUN (semua role).
            if (payload.eventType === 'INSERT') {
              tampilkanNotifikasi(payload.new?.pesan || 'Notifikasi baru');
            }
          }
        )
        .subscribe();
      // Cleanup keburu jalan sebelum channel ter-set → lepas segera.
      if (!active) supabase.removeChannel(channel);
    };
    init();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Izin notifikasi browser (semua role) — agar notif OS muncul, bukan cuma badge.
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) setIzinNotif(Notification.permission);
  }, []);

  const toggleSidebar = (state?: boolean) => {
    if (typeof state === 'boolean') {
      setSidebarOpen(state);
    } else {
      setSidebarOpen(!sidebarOpen);
    }
  };

  const handleNotifClick = async () => {
    setShowNotifDropdown(!showNotifDropdown);
    if (unreadNotifs > 0) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase
          .from('notifikasi')
          .update({ is_read: true })
          .eq('user_id', session.user.id)
          .eq('is_read', false);
      }
      setUnreadNotifs(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    }
  };

  const handleKirimLaporan = async () => {
    if (!helpdeskDeskripsi.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setHelpdeskSending(true);
    const { error } = await supabase.from('laporan').insert({
      user_id: session.user.id,
      role,
      deskripsi: helpdeskDeskripsi.trim(),
      status: 'menunggu'
    });
    setHelpdeskSending(false);
    if (error) {
      alert('Gagal mengirim laporan: ' + error.message);
    } else {
      setHelpdeskDeskripsi('');
      setShowHelpdesk(false);
      alert('Laporan terkirim ke admin!');
    }
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    // Hapus sesi Supabase (cookie) agar benar-benar keluar dari sesi aktif —
    // sebelumnya tombol ini hanya bernavigasi ke /login tanpa signOut().
    await supabase.auth.signOut();
    router.replace('/login');
  };

  const getNavLinks = () => {
    if (role === 'admin') {
      return [
        { name: 'Dashboard', href: '/admin/dashboard', icon: '📊' },
        { name: 'Kelola User', href: '/admin/users', icon: '👥' },
        { name: 'Master Kelas', href: '/admin/kelas', icon: '🏫' },
        { name: 'Management Jadwal', href: '/admin/jadwal', icon: '📅' },
        { name: 'Master Grid Jadwal', href: '/admin/slot-jadwal', icon: '⏰' },
        { name: 'Pengumuman', href: '/admin/pengumuman', icon: '📢' },
        { name: 'Helpdesk / Laporan', href: '/admin/laporan', icon: '🎧' },
        { name: 'Profil Saya', href: '/admin/profile', icon: '👤' },
        { name: 'Pengaturan', href: '/admin/pengaturan', icon: '⚙️' },
      ];
    } else if (role === 'guru') {
      return [
        { name: 'Dashboard', href: '/guru/dashboard', icon: '📊' },
        { name: 'Kelas Saya', href: '/guru/kelas', icon: '🏫' },
        { name: 'Ujian', href: '/guru/ujian', icon: '📝' },
        { name: 'Presensi', href: '/guru/presensi', icon: '📋' },
        { name: 'Penilaian', href: '/guru/penilaian', icon: '✍️' },
        { name: 'Rapor', href: '/guru/rapor', icon: '📄' },
        { name: 'Pengumuman', href: '/guru/pengumuman', icon: '📢' },
        { name: 'Helpdesk', href: '/guru/helpdesk', icon: '🎧' },
        { name: 'Profil Saya', href: '/guru/profile', icon: '👤' },
      ];
    } else {
      return [
        // Enam menu sesuai "Website Design.md" → TAMPILAN SISWA.
        // Materi & Tugas dijangkau lewat Kelas Saya → tombol "Materi" → "Kerjakan di Tugas".
        // Helpdesk lewat tombol float 🎧 di kanan bawah.
        { name: 'Dashboard', href: '/siswa/dashboard', icon: '📊' },
        { name: 'Profil Saya', href: '/siswa/profile', icon: '👤' },
        { name: 'Presensi', href: '/siswa/presensi', icon: '📍' },
        { name: 'Kelas Saya', href: '/siswa/kelas', icon: '🏫' },
        { name: 'Ujian', href: '/siswa/ujian', icon: '📝' },
        { name: 'Nilai Saya', href: '/siswa/nilai', icon: '🏆' },
      ];
    }
  };

  return (
    <div className="dashboard-shell">
      <GpsGate />
      {/* SIDEBAR */}
      <aside className={`sidebar ${sidebarOpen ? 'show' : ''}`}>
        <div className="sidebar-brand">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 10v6M2 10l10-5 10 5-10 5z"/>
            <path d="M6 12v5c3 3 9 3 12 0v-5"/>
          </svg>
          <span>{namaSekolah}</span>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar">
            {fotoProfil ? (
              <img src={fileUrl(fotoProfil)!} alt={displayName} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
            ) : (
              displayName.substring(0, 2).toUpperCase()
            )}
          </div>
          <div className="user-details">
            <span className="user-name">{displayName}</span>
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
          <button
            type="button"
            className="btn-logout"
            onClick={handleLogout}
            disabled={loggingOut}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', font: 'inherit', color: 'inherit', textAlign: 'left' }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            <span>{loggingOut ? 'Keluar...' : 'Keluar Sesi'}</span>
          </button>
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
              <div className="breadcrumb">{namaSekolah} / {role} / {pageTitle}</div>
            </div>
          </div>

          <div className="topbar-right" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div className="notification-wrapper" style={{ position: 'relative' }}>
              <button 
                className="btn-icon" 
                onClick={handleNotifClick}
                style={{ position: 'relative', background: 'transparent', border: 'none', cursor: 'pointer', padding: '5px' }}
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                  <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
                </svg>
                {unreadNotifs > 0 && (
                  <span style={{
                    position: 'absolute', top: '0', right: '0', background: 'red', color: 'white', 
                    borderRadius: '50%', padding: '2px 6px', fontSize: '10px', fontWeight: 'bold'
                  }}>
                    {unreadNotifs}
                  </span>
                )}
              </button>
              {showNotifDropdown && (
                <div style={{
                  position: 'absolute', top: '40px', right: '0', background: 'white', 
                  border: '1px solid #ddd', borderRadius: '8px', width: '250px', 
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)', zIndex: 100
                }}>
                  <div style={{ padding: '10px', borderBottom: '1px solid #ddd', fontWeight: 'bold' }}>Notifikasi</div>
                  {notifications.length === 0 ? (
                    <div style={{ padding: '15px', fontSize: '14px', color: '#666' }}>
                      Belum ada notifikasi baru.
                    </div>
                  ) : (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                      {notifications.map((n) => (
                        <div key={n.id} style={{ padding: '10px', borderBottom: '1px solid #eee', fontSize: '13px', color: n.is_read ? '#999' : '#333' }}>
                          {n.pesan}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="topbar-user-info" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px' }}>
              {fotoProfil ? (
                <img
                  src={fileUrl(fotoProfil)!}
                  alt={displayName}
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid var(--slate-200, #e2e8f0)', flexShrink: 0 }}
                />
              ) : (
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--primary, #4f46e5)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '14px', flexShrink: 0 }}>
                  {displayName.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', lineHeight: '1.2' }}>
                <span>{displayName}</span>
                <span className="badge badge-primary">{role}</span>
              </div>
            </div>
          </div>
        </header>

        {/* MAIN VIEW CONTAINER */}
        <main className="main-body">
          {children}
        </main>
      </div>

      {/* Banner izin notifikasi (muncul bila belum diputuskan) */}
      {izinNotif === 'default' && (
        <div style={{
          position: 'fixed', bottom: '24px', left: '24px', zIndex: 1000, background: '#fff',
          padding: '12px 16px', borderRadius: '10px', boxShadow: '0 4px 14px rgba(0,0,0,0.15)',
          display: 'flex', gap: '10px', alignItems: 'center', maxWidth: '340px',
        }}>
          <span style={{ fontSize: '13px' }}>Aktifkan notifikasi browser untuk info tugas, ujian, &amp; pengumuman.</span>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={async () => {
              const p = await Notification.requestPermission();
              setIzinNotif(p);
              if (p === 'granted') tampilkanNotifikasi('Notifikasi browser aktif. Kamu akan menerima info di sini.', 'Berhasil');
            }}
          >
            Aktifkan
          </button>
        </div>
      )}

      {/* Floating Helpdesk (call-center) — siswa & guru */}
      {role !== 'admin' && (
        <>
          <button
            type="button"
            onClick={() => setShowHelpdesk(true)}
            title="Helpdesk / Lapor Kendala"
            style={{
              position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000,
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'var(--primary, #4f46e5)', color: 'white', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0,0,0,0.25)', cursor: 'pointer', fontSize: '26px'
            }}
          >
            🎧
          </button>

          {showHelpdesk && (
            <div className="modal-overlay" onClick={() => setShowHelpdesk(false)}>
              <div className="modal-dialog" style={{ maxWidth: '420px' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3>🎧 Helpdesk / Lapor Kendala</h3>
                  <button type="button" className="btn-close-modal" onClick={() => setShowHelpdesk(false)}>&times;</button>
                </div>
                <div className="modal-body">
                  <p className="text-muted" style={{ fontSize: '13px' }}>Laporkan kendala aplikasi ke Admin.</p>
                  <div className="form-group">
                    <label>Deskripsi Kendala</label>
                    <textarea
                      className="form-control"
                      rows={4}
                      placeholder="Jelaskan kendala yang Anda alami..."
                      value={helpdeskDeskripsi}
                      onChange={(e) => setHelpdeskDeskripsi(e.target.value)}
                    ></textarea>
                  </div>
                  <div className="d-flex justify-between mt-3 align-center">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowHelpdesk(false)}>Batal</button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleKirimLaporan}
                      disabled={helpdeskSending || !helpdeskDeskripsi.trim()}
                    >
                      {helpdeskSending ? 'Mengirim...' : 'Kirim Laporan'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
