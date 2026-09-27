import { supabase } from './supabase';

export interface KopPdfOptions {
  title: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  filename: string;
}

// Generate PDF berkop surat (letterhead) dari tabel pengaturan + jsPDF + autotable.
// Dipakai untuk Daftar Populasi, Jadwal, Presensi, dan e-Rapor.
export async function generateKopPdf(opts: KopPdfOptions) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  let namaSekolah = 'SMP Matematika';
  let kopSurat = '';
  let alamat = '';
  try {
    const { data } = await supabase.from('pengaturan').select('*').limit(1).single();
    if (data) {
      namaSekolah = data.nama_sekolah || namaSekolah;
      kopSurat = data.kop_surat || '';
      alamat = data.alamat || '';
    }
  } catch {
    // fallback ke nilai default bila pengaturan belum tersedia
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Kop surat
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(namaSekolah, pageWidth / 2, 20, { align: 'center' });

  const alamatBaris = [kopSurat, alamat].filter(Boolean).join(' — ');
  if (alamatBaris) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(alamatBaris, pageWidth / 2, 26, { align: 'center' });
  }

  // Garis kop
  doc.setLineWidth(0.6);
  doc.line(14, 30, pageWidth - 14, 30);
  doc.setLineWidth(0.2);
  doc.line(14, 31.5, pageWidth - 14, 31.5);

  // Judul
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(opts.title, pageWidth / 2, 39, { align: 'center' });

  let startY = 45;
  if (opts.subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(opts.subtitle, pageWidth / 2, 45, { align: 'center' });
    startY = 50;
  }

  autoTable(doc, {
    startY,
    head: [opts.columns],
    body: opts.rows,
    styles: { fontSize: 8.5, cellPadding: 2 },
    headStyles: { fillColor: [79, 70, 229], halign: 'center' },
    margin: { left: 14, right: 14 },
  });

  doc.save(opts.filename);
}
