'use client';
import { useState, useEffect, useCallback } from 'react';

// Gerbang GPS global: wajib aktif di semua halaman (semua role).
// Jika izin lokasi belum diaktifkan, tampilkan modal yang tidak bisa ditutup.
export default function GpsGate() {
  const [state, setState] = useState<'checking' | 'granted' | 'denied'>('checking');

  const check = useCallback(async () => {
    setState('checking');
    try {
      if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
        setState('denied');
        return;
      }

      // 1. Cek status izin (akurat bila browser mendukung)
      if (navigator.permissions?.query) {
        const status: any = await navigator.permissions.query({ name: 'geolocation' } as any);
        if (status?.state === 'granted') { setState('granted'); return; }
        if (status?.state === 'denied') { setState('denied'); return; }
      }

      // 2. Minta izin (bila status 'prompt' atau permissions.query tak didukung)
      const granted = await new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          (err) => resolve(err.code !== 1), // code 1 = PERMISSION_DENIED
          { timeout: 10000 }
        );
      });
      setState(granted ? 'granted' : 'denied');
    } catch {
      setState('denied');
    }
  }, []);

  useEffect(() => {
    check();
    window.addEventListener('focus', check);
    return () => window.removeEventListener('focus', check);
  }, [check]);

  if (state !== 'denied') return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,23,42,0.72)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
      }}
    >
      <div className="card card-body" style={{ maxWidth: '440px', textAlign: 'center', margin: 0, borderRadius: '16px', padding: '28px 24px' }}>
        <div
          style={{
            width: '72px', height: '72px', borderRadius: '50%', background: '#fee2e2',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '34px', margin: '0 auto 16px'
          }}
        >
          📍
        </div>
        <h3 style={{ margin: '0 0 8px' }}>GPS Belum Diaktifkan</h3>
        <p className="text-muted" style={{ margin: '0 0 20px', fontSize: '14px', lineHeight: '1.6' }}>
          Aplikasi ini memerlukan akses lokasi (GPS). Aktifkan izin lokasi di browser Anda, lalu klik tombol di bawah.
        </p>
        <button className="btn btn-primary" onClick={check} style={{ width: '100%', padding: '12px' }}>
          🔄 Coba Lagi
        </button>
      </div>
    </div>
  );
}
