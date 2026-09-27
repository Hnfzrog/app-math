'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { customAlert } from '@/lib/customAlert';

export default function AdminJadwal() {
  const [loading, setLoading] = useState(true);
  const [gurus, setGurus] = useState<any[]>([]);
  const [kelas, setKelas] = useState<any[]>([]);
  const [jadwals, setJadwals] = useState<any[]>([]);
  const [timeSlots, setTimeSlots] = useState<any[]>([]);
  const [days, setDays] = useState<string[]>([]);

  // State for manual entry / generator
  const [selectedGuru, setSelectedGuru] = useState('');
  const [selectedKelas, setSelectedKelas] = useState('');
  const [selectedDay, setSelectedDay] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');

  const [conflicts, setConflicts] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [guruRes, kelasRes, jadwalRes, slotRes, hariRes] = await Promise.all([
      supabase.from('users').select('id, nama').eq('role', 'guru').order('nama'),
      supabase.from('kelas').select('id, nama').order('nama'),
      supabase.from('jadwal').select('id, guru_id, kelas_id, hari, jam_mulai, jam_selesai'),
      supabase.from('slot_jam').select('*').order('jam_mulai'),
      supabase.from('hari').select('*').order('urutan')
    ]);

    if (guruRes.data) setGurus(guruRes.data);
    if (kelasRes.data) setKelas(kelasRes.data);

    if (hariRes.data && hariRes.data.length > 0) {
      setDays(hariRes.data.map((h: any) => h.nama));
      setSelectedDay(prev => prev || hariRes.data[0].nama);
    }

    if (slotRes.data && slotRes.data.length > 0) {
      const formatted = slotRes.data.map((s: any) => ({ id: s.id, label: `${s.jam_mulai.slice(0,5)} - ${s.jam_selesai.slice(0,5)}` }));
      setTimeSlots(formatted);
      setSelectedSlot(prev => prev || formatted[0].label);
    }
    
    // Process jadwal for frontend mapping
    if (jadwalRes.data) {
      const formattedJadwal = jadwalRes.data.map(j => ({
        id: j.id,
        guru_id: j.guru_id,
        kelas_id: j.kelas_id,
        hari: j.hari,
        slot: `${j.jam_mulai.slice(0,5)} - ${j.jam_selesai.slice(0,5)}` // e.g. "07:00 - 08:30"
      }));
      setJadwals(formattedJadwal);
    }
    
    setLoading(false);
    checkConflicts(jadwalRes.data || []);
  };

  const checkConflicts = (jadwalData: any[]) => {
    // Deteksi bentrok: (1) guru ngajar >1 kelas pada waktu sama, (2) kelas diisi >1 guru pada waktu sama
    const guruMap: Record<string, string[]> = {};
    const kelasMap: Record<string, string[]> = {};
    const newConflicts: string[] = [];

    jadwalData.forEach(j => {
      const slotStr = `${j.jam_mulai.slice(0,5)} - ${j.jam_selesai.slice(0,5)}`;
      const guruKey = `${j.guru_id}_${j.hari}_${slotStr}`;
      const kelasKey = `${j.kelas_id}_${j.hari}_${slotStr}`;
      if (!guruMap[guruKey]) guruMap[guruKey] = [];
      guruMap[guruKey].push(j.kelas_id);
      if (!kelasMap[kelasKey]) kelasMap[kelasKey] = [];
      kelasMap[kelasKey].push(j.guru_id);
    });

    Object.keys(guruMap).forEach(key => {
      if (guruMap[key].length > 1) {
        const [guruId, hari, slot] = key.split('_');
        const guru = gurus.find(g => g.id === guruId)?.nama;
        newConflicts.push(`Konflik Guru: ${guru || guruId} mengajar ${guruMap[key].length} kelas pada ${hari} pukul ${slot}`);
      }
    });

    Object.keys(kelasMap).forEach(key => {
      if (kelasMap[key].length > 1) {
        const [kelasId, hari, slot] = key.split('_');
        const kelasName = kelas.find(k => k.id === kelasId)?.nama;
        newConflicts.push(`Konflik Kelas: ${kelasName || kelasId} diisi ${kelasMap[key].length} guru pada ${hari} pukul ${slot}`);
      }
    });

    setConflicts(newConflicts);
  };

  const handleAddManual = async (e: any) => {
    e.preventDefault();
    if (!selectedGuru || !selectedKelas) {
      customAlert('Pilih guru dan kelas!', true);
      return;
    }

    const [start, end] = selectedSlot.split(' - ');
    
    const { data, error } = await supabase.from('jadwal').insert([{
      guru_id: selectedGuru,
      kelas_id: selectedKelas,
      hari: selectedDay,
      jam_mulai: start + ':00',
      jam_selesai: end + ':00'
    }]).select();

    if (error) {
      customAlert('Gagal menambah jadwal: ' + error.message, true);
    } else {
      fetchData();
    }
  };

  const hapusJadwal = async (id: string) => {
    await supabase.from('jadwal').delete().eq('id', id);
    fetchData();
  };

  const handleGenerate = async () => {
    setGenerating(true);

    if (timeSlots.length === 0) {
      customAlert('Belum ada slot jam. Atur dulu di menu Master Grid Jadwal.', true);
      setGenerating(false);
      return;
    }

    // 1. Ambil penugasan guru → kelas
    const { data: gk } = await supabase.from('guru_kelas').select('guru_id, kelas_id');
    if (!gk || gk.length === 0) {
      customAlert('Belum ada guru yang ditugaskan ke kelas. Atur di menu Kelola User.', true);
      setGenerating(false);
      return;
    }

    // 2. Hapus jadwal lama
    await supabase.from('jadwal').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    // 3. Randomize hari + jam, cegah bentrok (guru & kelas)
    const allSlots: { day: string, label: string }[] = [];
    days.forEach(day => timeSlots.forEach(slot => allSlots.push({ day, label: slot.label })));

    const shuffled = [...gk].sort(() => Math.random() - 0.5);
    const guruBusy = new Set<string>();
    const kelasBusy = new Set<string>();

    const inserts: any[] = [];
    const unassigned: string[] = [];

    for (const mapping of shuffled) {
      const shuffledSlots = [...allSlots].sort(() => Math.random() - 0.5);
      let placed = false;

      for (const { day, label } of shuffledSlots) {
        const guruKey = `${mapping.guru_id}_${day}_${label}`;
        const kelasKey = `${mapping.kelas_id}_${day}_${label}`;
        if (!guruBusy.has(guruKey) && !kelasBusy.has(kelasKey)) {
          guruBusy.add(guruKey);
          kelasBusy.add(kelasKey);
          const [start, end] = label.split(' - ');
          inserts.push({
            guru_id: mapping.guru_id,
            kelas_id: mapping.kelas_id,
            hari: day,
            jam_mulai: start + ':00',
            jam_selesai: end + ':00'
          });
          placed = true;
          break;
        }
      }

      if (!placed) {
        const guruName = gurus.find(g => g.id === mapping.guru_id)?.nama || mapping.guru_id;
        const kelasName = kelas.find(k => k.id === mapping.kelas_id)?.nama || mapping.kelas_id;
        unassigned.push(`${guruName} → ${kelasName}`);
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from('jadwal').insert(inserts);
      if (error) {
        customAlert('Gagal generate jadwal: ' + error.message, true);
      } else if (unassigned.length > 0) {
        customAlert(`${inserts.length} jadwal dibuat. ${unassigned.length} tidak kebagian slot bebas bentrok: ${unassigned.join('; ')}`, true);
      } else {
        customAlert(`${inserts.length} jadwal berhasil digenerate otomatis tanpa bentrok!`);
      }
    } else {
      customAlert('Tidak ada slot yang cukup untuk semua penugasan (cek jumlah guru & kelas).', true);
    }

    fetchData();
    setGenerating(false);
  };

  const getJadwalCell = (day: string, slotLabel: string) => {
    // Find all schedules in this exact slot
    const matches = jadwals.filter(j => j.hari === day && j.slot === slotLabel);
    if (matches.length === 0) return <span className="text-muted">-</span>;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {matches.map(j => {
          const guruName = gurus.find(g => g.id === j.guru_id)?.nama || 'Unknown';
          const kelasName = kelas.find(k => k.id === j.kelas_id)?.nama || 'Unknown';
          return (
            <div key={j.id} style={{ padding: '4px', background: '#e0f2fe', borderRadius: '4px', fontSize: '12px', borderLeft: '3px solid #0284c7' }}>
              <strong>{kelasName}</strong><br/>
              {guruName}
              <button 
                onClick={() => hapusJadwal(j.id)} 
                style={{ background: 'none', border: 'none', color: 'red', cursor: 'pointer', float: 'right', fontSize: '14px' }}
                title="Hapus jadwal ini"
              >&times;</button>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div>
      <div className="card card-body mb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 className="mb-2">Management Jadwal</h3>
            <p className="text-muted m-0">Atur jadwal guru mengajar agar tidak bentrok.</p>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={() => window.print()}>📄 Download / Print PDF</button>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
              {generating ? 'Memproses...' : '✨ Generate Otomatis'}
            </button>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="alert alert-danger mt-4">
            <strong>⚠️ Terdapat Konflik Jadwal!</strong>
            <ul style={{ margin: '8px 0 0', paddingLeft: '20px' }}>
              {conflicts.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
        )}
      </div>

      <div className="card card-body mb-4 print-hide">
        <h4>Tambah Jadwal Manual</h4>
        <form onSubmit={handleAddManual} style={{ display: 'flex', gap: '15px', marginTop: '15px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label>Guru</label>
            <select className="form-control" value={selectedGuru} onChange={e => setSelectedGuru(e.target.value)} required>
              <option value="">Pilih Guru...</option>
              {gurus.map(g => <option key={g.id} value={g.id}>{g.nama}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label>Kelas</label>
            <select className="form-control" value={selectedKelas} onChange={e => setSelectedKelas(e.target.value)} required>
              <option value="">Pilih Kelas...</option>
              {kelas.map(k => <option key={k.id} value={k.id}>{k.nama}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label>Hari</label>
            <select className="form-control" value={selectedDay} onChange={e => setSelectedDay(e.target.value)}>
              {days.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: '150px' }}>
            <label>Waktu</label>
            <select className="form-control" value={selectedSlot} onChange={e => setSelectedSlot(e.target.value)}>
              {timeSlots.map(t => <option key={t.id} value={t.label}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>+ Tambah</button>
          </div>
        </form>
      </div>

      <div className="card card-body print-section">
        <h3 className="mb-4">Grid Jadwal Pelajaran</h3>
        
        {loading ? (
          <p className="text-center">Loading data...</p>
        ) : (
          <div className="table-responsive">
            <table className="table" style={{ tableLayout: 'fixed', minWidth: '800px' }}>
              <thead style={{ background: '#f8fafc' }}>
                <tr>
                  <th style={{ width: '120px' }}>Waktu</th>
                  {days.map(day => <th key={day} className="text-center">{day}</th>)}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map(slot => (
                  <tr key={slot.id}>
                    <td style={{ fontWeight: 'bold', verticalAlign: 'middle' }}>{slot.label}</td>
                    {days.map(day => (
                      <td key={`${day}-${slot.id}`} style={{ verticalAlign: 'top' }}>
                        {getJadwalCell(day, slot.label)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {/* Print CSS */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          .print-section, .print-section * {
            visibility: visible;
          }
          .print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .print-section::before {
            content: "JADWAL PELAJARAN EDUSCHOOL";
            display: block;
            font-size: 24px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 20px;
          }
          .print-hide { display: none !important; }
          .sidebar, .topbar { display: none !important; }
          button { display: none !important; }
        }
      `}} />
    </div>
  );
}
