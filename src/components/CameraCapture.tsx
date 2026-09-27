'use client';
import { useRef, useState, useEffect } from 'react';

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

  const stop = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setActive(false);
  };

  const start = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setActive(true);
      setTimeout(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      }, 0);
    } catch (e: any) {
      setError('Tidak bisa membuka kamera: ' + (e?.message || e));
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
          <video ref={videoRef} autoPlay playsInline muted style={{ width: '100%', maxWidth: '320px', borderRadius: '8px', background: '#000', display: 'block' }} />
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
