'use client';
import { useRef, useState, useEffect, useCallback } from 'react';

// Buka kamera (getUserMedia), tampilkan live, ambil foto, kompres, hasilkan File.
export default function CameraCapture({ onCapture }: { onCapture: (file: File | null) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // Pasang stream begitu elemen <video> ter-mount (setelah active=true), lalu panggil play()
  // secara eksplisit. Sebelumnya srcObject dipasang via setTimeout(0) yang rawan race — kalau
  // <video> belum ter-render, videoRef.current masih null sehingga stream tak pernah terpasang
  // (layar hitam). Callback ref memastikan pemasangan terjadi tepat saat elemen sudah ada.
  const attachVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(() => { /* autoplay policy — abaikan */ });
    }
  }, []);

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const start = async () => {
    setError('');
    try {
      // ideal (bukan eksak) agar di perangkat tanpa kamera belakang (laptop/PC webcam depan)
      // browser tetap memakai kamera yang tersedia, bukan gagal.
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } });
      streamRef.current = stream;
      setActive(true);
    } catch (e: any) {
      const name = e?.name || '';
      if (name === 'NotAllowedError') {
        setError('Akses kamera ditolak. Izinkan kamera di pengaturan browser, lalu coba lagi.');
      } else if (name === 'NotFoundError') {
        setError('Tidak ada kamera terdeteksi di perangkat ini.');
      } else {
        setError('Tidak bisa membuka kamera: ' + (e?.message || e));
      }
    }
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    // Kompres: resize maks 640px + JPEG kualitas 0.6 (hasil ~30-50KB per foto)
    const maxDim = 640;
    const scale = Math.min(1, maxDim / Math.max(video.videoWidth, video.videoHeight));
    const w = Math.round(video.videoWidth * scale);
    const h = Math.round(video.videoHeight * scale);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], 'presensi.jpg', { type: 'image/jpeg' });
      setPreview(URL.createObjectURL(blob));
      onCapture(file);
      stop();
    }, 'image/jpeg', 0.6);
  };

  const retake = () => {
    setPreview(null);
    onCapture(null);
    start();
  };

  return (
    <div>
      {preview ? (
        <div>
          <img src={preview} alt="Hasil foto presensi" style={{ width: '100%', maxWidth: '320px', borderRadius: '8px', display: 'block' }} />
          <button type="button" className="btn btn-sm btn-outline mt-2" onClick={retake}>📷 Ambil Ulang</button>
        </div>
      ) : active ? (
        <div>
          <video ref={attachVideo} autoPlay playsInline muted style={{ width: '100%', maxWidth: '320px', borderRadius: '8px', background: '#000', display: 'block' }} />
          <div className="d-flex gap-2 mt-2">
            <button type="button" className="btn btn-primary" onClick={capture}>📸 Ambil Foto</button>
            <button type="button" className="btn btn-outline" onClick={stop}>Batal</button>
          </div>
        </div>
      ) : (
        <button type="button" className="btn btn-primary" onClick={start}>📷 Buka Kamera</button>
      )}
      {error && <p className="text-danger text-sm mt-2">{error}</p>}
    </div>
  );
}
