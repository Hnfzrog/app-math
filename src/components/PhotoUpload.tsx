'use client';
import { useState } from 'react';
import { fileUrl } from '@/lib/uploadClient';

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

interface PhotoUploadProps {
  value: string | null;                    // key tersimpan ATAU URL external (Drive)
  onFileChange: (file: File | null) => void;
  onLinkChange?: (url: string) => void;    // untuk link Google Drive (file besar/video)
  label?: string;
  capture?: boolean;
  accept?: string;                          // jenis file, default gambar
  showDrive?: boolean;                      // tampilkan input link Drive
}

export default function PhotoUpload({
  value,
  onFileChange,
  onLinkChange,
  label = 'File',
  capture = false,
  accept = 'image/*',
  showDrive = false
}: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [driveLink, setDriveLink] = useState('');

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && file.size > MAX_SIZE) {
      alert('File melebihi 2MB. Gunakan link Google Drive untuk file besar/video.');
      e.target.value = '';
      return;
    }
    onFileChange(file);
    setPreview(file ? URL.createObjectURL(file) : null);
    e.target.value = '';
  };

  const handleLink = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setDriveLink(url);
    if (onLinkChange) onLinkChange(url);
  };

  const src = preview || fileUrl(value);

  return (
    <div>
      {src && (
        <div style={{ marginBottom: '8px' }}>
          <img
            src={src}
            alt={label}
            style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '10px', border: '1px solid var(--slate-200, #e2e8f0)' }}
          />
        </div>
      )}
      <input
        type="file"
        accept={accept}
        capture={capture ? 'environment' : undefined}
        onChange={handleFile}
        className="form-control"
      />
      {showDrive && onLinkChange && (
        <div className="mt-2">
          <label style={{ fontSize: '13px', display: 'block' }}>atau link Google Drive (file besar / video)</label>
          <input
            type="url"
            className="form-control"
            value={driveLink}
            onChange={handleLink}
            placeholder="https://drive.google.com/..."
          />
        </div>
      )}
    </div>
  );
}
