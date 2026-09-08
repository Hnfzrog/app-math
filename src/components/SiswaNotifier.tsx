'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useCurrentUser } from '@/lib/hooks/useCurrentUser';

export default function SiswaNotifier() {
  const { userId: SISWA_ID } = useCurrentUser();

  const [permission, setPermission] = useState<NotificationPermission | 'unknown'>('unknown');
  const [toasts, setToasts] = useState<{id: number, title: string, body: string}[]>([]);

  const addToast = (title: string, body: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, title, body }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000); // Hilang otomatis dalam 5 detik
  };

  const [kelasIds, setKelasIds] = useState<Set<string>>(new Set());
  const [babIds, setBabIds] = useState<Set<string>>(new Set());
  const [kontenIds, setKontenIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }

    // Fetch initial context for filtering
    const initData = async () => {
      const { data: kls } = await supabase.from('siswa_kelas').select('kelas_id').eq('siswa_id', SISWA_ID);
      if (!kls || kls.length === 0) return;
      const myKelas = new Set(kls.map(k => k.kelas_id));
      setKelasIds(myKelas);

      const { data: bbs } = await supabase.from('bab').select('id').in('kelas_id', Array.from(myKelas));
      const myBabs = new Set(bbs?.map(b => b.id) || []);
      setBabIds(myBabs);

      const { data: knts } = await supabase.from('konten').select('id').in('bab_id', Array.from(myBabs));
      setKontenIds(new Set(knts?.map(k => k.id) || []));
    };
    initData();

    // Subscribe ke penambahan/update Kuis/Modul Baru (tabel konten)
    const kontenChannel = supabase.channel('konten-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'bab' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setKelasIds(prevKelas => {
              if (prevKelas.has(payload.new.kelas_id)) {
                setBabIds(prevBabs => new Set(prevBabs).add(payload.new.id));
                const action = payload.eventType === 'INSERT' ? 'ditambahkan' : 'diperbarui';
                tampilkanNotifikasi('Bab ' + (payload.eventType === 'INSERT' ? 'Baru!' : 'Diupdate'), `Guru telah ${action} bab: ${payload.new.judul}`);
              }
              return prevKelas;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'konten' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setBabIds(prevBabs => {
              if (prevBabs.has(payload.new.bab_id)) {
                setKontenIds(prevKonten => new Set(prevKonten).add(payload.new.id));
                const action = payload.eventType === 'INSERT' ? 'menambahkan' : 'memperbarui';
                const tipe = ['lkpd','banksoal','evaluasi'].includes(payload.new.tipe) ? 'tugas' : 'materi';
                tampilkanNotifikasi(`${tipe.charAt(0).toUpperCase() + tipe.slice(1)} ${payload.eventType === 'INSERT' ? 'Baru' : 'Diupdate'}!`, `Guru ${action} ${tipe}: ${payload.new.judul}`);
              }
              return prevBabs;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'soal' },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setKontenIds(prevKontens => {
              if (prevKontens.has(payload.new.konten_id)) {
                const action = payload.eventType === 'INSERT' ? 'menambahkan' : 'mengubah';
                tampilkanNotifikasi('Soal Diupdate!', `Guru baru saja ${action} butir soal di tugasmu.`);
              }
              return prevKontens;
            });
          }
        }
      )
      .subscribe();

    // Subscribe ke penilaian kuis (tabel jawaban_siswa)
    const nilaiChannel = supabase.channel('nilai-changes')
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'jawaban_siswa',
          filter: `siswa_id=eq.${SISWA_ID}` // Hanya notif jika siswa ini yang dinilai
        },
        (payload) => {
          const newData = payload.new;
          const oldData = payload.old;
          
          // Jika status berubah menjadi final, berarti guru baru saja memverifikasi nilai
          if (newData.status === 'final' && oldData.status !== 'final') {
            tampilkanNotifikasi(
              'Nilaimu Sudah Keluar!',
              `Guru telah memverifikasi nilaimu. Buka menu Nilai Saya untuk melihat hasilnya!`
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(kontenChannel);
      supabase.removeChannel(nilaiChannel);
    };
  }, []);

  const tampilkanNotifikasi = (title: string, body: string) => {
    // OS-Level Notification (Muncul di layar desktop layaknya notif WA)
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(title, {
        body: body,
        icon: '/favicon.ico', // Default Next.js icon
        requireInteraction: true, // Biar notifnya nggak langsung hilang sebelum diklik
        tag: 'edu-notif'
      });
    } else {
      // Fallback yang benar: In-app Toast / Banner (Bukan alert blocking!)
      addToast(title, body);
    }
  };

  const requestPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm === 'granted') {
        new Notification("Notifikasi Aktif!", { body: "Kamu akan menerima notif saat ada tugas atau nilai baru." });
      }
    }
  };

  if (permission === 'default' || permission === 'unknown') {
    return (
      <div style={{
        position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#fff', 
        padding: '15px 20px', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        zIndex: 9999, borderLeft: '4px solid var(--color-primary)', display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '300px'
      }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: '500' }}>Aktifkan Notifikasi Browser untuk info tugas baru & nilai langsung di Desktop kamu.</p>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={requestPermission} className="btn btn-primary btn-sm" style={{ padding: '5px 10px', fontSize: '12px' }}>Aktifkan</button>
          <button onClick={() => setPermission('denied')} className="btn btn-outline btn-sm" style={{ padding: '5px 10px', fontSize: '12px' }}>Nanti Saja</button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Fallback In-App Toast Container */}
      <div style={{ position: 'fixed', top: '20px', right: '20px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {toasts.map(toast => (
          <div key={toast.id} style={{ 
            background: '#fff', borderLeft: '4px solid var(--color-primary)', 
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '15px 20px', 
            borderRadius: '8px', minWidth: '250px', animation: 'fadeIn 0.3s ease-in-out'
          }}>
            <h4 style={{ margin: '0 0 5px 0', fontSize: '15px' }}>{toast.title}</h4>
            <p style={{ margin: 0, fontSize: '13px', color: '#555' }}>{toast.body}</p>
          </div>
        ))}
      </div>
    </>
  );
}
