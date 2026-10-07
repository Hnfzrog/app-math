import { nilaiHuruf, deskripsiCapaian, labelSemester } from './rapor';

export interface RaporPdfData {
  namaSekolah: string;
  kopSurat?: string;
  alamat?: string;
  siswa: {
    nama: string;
    nisn?: string | null;
    kelas: string;
    semester: string;
    tahunAjaran?: string | null;
  };
  kkm: number;
  nilai: { judul: string; nilaiAkhir: number | null }[];
  kegiatanPengembangan: { kegiatan: string; deskripsi: string }[];
  akhlakKepribadian: { deskripsi: string }[];
  ketidakhadiran: { sakit: number; izin: number; tanpaKeterangan: number };
  catatanWaliKelas: string;
  waliKelas: string;
  namaWali?: string | null;
  rataRata: number | null;
}

/**
 * PDF rapor formal "Laporan Hasil Belajar Peserta Didik" (layout menyerupai gambar),
 * isi per-bab Matematika. Dipakai guru (unduh per siswa) & siswa (unduh rapor sendiri).
 */
export async function generateRaporPdf(data: RaporPdfData) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const marginX = 14;
  const contentW = pageWidth - marginX * 2;

  const fmt = (v: number | null | undefined): string =>
    v === null || v === undefined || Number.isNaN(v) ? '-' : Number(v).toFixed(2);

  // ---- Kop surat ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(data.namaSekolah, pageWidth / 2, 18, { align: 'center' });

  const alamatBaris = [data.kopSurat, data.alamat].filter(Boolean).join(' — ');
  if (alamatBaris) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(alamatBaris, pageWidth / 2, 24, { align: 'center' });
  }
  doc.setLineWidth(0.7);
  doc.line(marginX, 28, pageWidth - marginX, 28);
  doc.setLineWidth(0.2);
  doc.line(marginX, 29.5, pageWidth - marginX, 29.5);

  // ---- Judul ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('LAPORAN HASIL BELAJAR PESERTA DIDIK', pageWidth / 2, 38, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Semester ' + labelSemester(data.siswa.semester), pageWidth / 2, 44, { align: 'center' });

  // ---- Identitas ----
  autoTable(doc, {
    startY: 48,
    theme: 'grid',
    head: [],
    body: [
      ['Nama Peserta Didik', data.siswa.nama, 'NISN', data.siswa.nisn || '-'],
      ['Kelas', data.siswa.kelas, 'Semester', labelSemester(data.siswa.semester)],
      ['Tahun Pelajaran', data.siswa.tahunAjaran || '-', 'Wali Kelas', data.waliKelas || '-'],
    ],
    styles: { fontSize: 9, cellPadding: 2.5, overflow: 'linebreak' },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 38 },
      1: { cellWidth: (contentW - 76) / 2 },
      2: { fontStyle: 'bold', cellWidth: 38 },
      3: { cellWidth: (contentW - 76) / 2 },
    },
    margin: { left: marginX, right: marginX },
  });

  let y = (doc as any).lastAutoTable.finalY + 6;

  // ---- Tabel nilai per bab ----
  const head = [['No', 'Mata Pelajaran / Bab', 'KKM', 'Nilai Angka', 'Nilai Huruf', 'Deskripsi Kemajuan Belajar']];
  const body = data.nilai.map((n, i) => [
    String(i + 1),
    'Matematika · ' + n.judul,
    String(data.kkm),
    fmt(n.nilaiAkhir),
    nilaiHuruf(n.nilaiAkhir) ?? '-',
    deskripsiCapaian(n.judul, n.nilaiAkhir, data.kkm),
  ]);

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [79, 70, 229], halign: 'center', valign: 'middle' },
    columnStyles: {
      0: { cellWidth: 10, halign: 'center' },
      1: { cellWidth: 52 },
      2: { cellWidth: 14, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 18, halign: 'center' },
      5: { cellWidth: contentW - 114 },
    },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 4;

  // Rata-rata di kaki tabel nilai
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(
    `Rata-rata: ${fmt(data.rataRata)} (${nilaiHuruf(data.rataRata) ?? '-'})`,
    pageWidth - marginX,
    y,
    { align: 'right' }
  );
  y += 6;

  // ---- Kegiatan Pengembangan Diri ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Kegiatan Pengembangan Diri', marginX, y);
  y += 2;
  const kpd = data.kegiatanPengembangan;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['No', 'Kegiatan', 'Deskripsi']],
    body: kpd.length
      ? kpd.map((k, i) => [String(i + 1), k.kegiatan || '-', k.deskripsi || '-'])
      : [['-', '-', '-']],
    styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [79, 70, 229], halign: 'center' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' }, 1: { cellWidth: 60 } },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ---- Akhlak & Kepribadian ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Akhlak Mulia dan Kepribadian', marginX, y);
  y += 2;
  const akhlak = data.akhlakKepribadian;
  autoTable(doc, {
    startY: y,
    theme: 'grid',
    head: [['No', 'Deskripsi']],
    body: akhlak.length ? akhlak.map((a, i) => [String(i + 1), a.deskripsi || '-']) : [['-', '-']],
    styles: { fontSize: 8.5, cellPadding: 2.5, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: [79, 70, 229], halign: 'center' },
    columnStyles: { 0: { cellWidth: 10, halign: 'center' } },
    margin: { left: marginX, right: marginX },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // ---- Ketidakhadiran ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Ketidakhadiran', marginX, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const k = data.ketidakhadiran;
  doc.text(`Sakit: ${k.sakit} hari    Izin: ${k.izin} hari    Tanpa Keterangan: ${k.tanpaKeterangan} hari`, marginX, y);
  y += 10;

  // ---- Catatan Wali Kelas ----
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Catatan Wali Kelas', marginX, y);
  y += 4;
  const catatan = data.catatanWaliKelas || '-';
  const catatanLines = doc.splitTextToSize(catatan, contentW - 12);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(catatanLines, marginX + 2, y);
  const catatanH = Math.max(12, catatanLines.length * 4.5 + 8);
  doc.setDrawColor(0);
  doc.setLineWidth(0.2);
  doc.rect(marginX, y - 4, contentW, catatanH);
  y += catatanH + 10;

  // ---- Tanda tangan ----
  const today = new Date();
  const tanggal = `${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}`;
  const leftX = marginX + 20;
  const rightX = pageWidth - marginX - 20;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Mengetahui,', leftX, y);
  doc.text('Orang Tua/Wali', leftX, y + 5);
  doc.text(data.namaWali || '', leftX, y + 30);
  doc.text('(_______________________)', leftX, y + 35);

  doc.text(`${data.namaSekolah}, ${tanggal}`, rightX, y, { align: 'center' });
  doc.text('Wali Kelas', rightX, y + 5, { align: 'center' });
  doc.text(data.waliKelas || '', rightX, y + 30, { align: 'center' });
  doc.text('(_______________________)', rightX, y + 35, { align: 'center' });

  doc.save('rapor.pdf');
}
