-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. USERS TABLE (Extends Supabase Auth)
create table public.users (
  id uuid references auth.users not null primary key,
  email text not null,
  role text not null check (role in ('admin', 'guru', 'siswa')),
  nama text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. KELAS TABLE
create table public.kelas (
  id uuid default uuid_generate_v4() primary key,
  nama text not null, -- computed or backwards compatible (angkatan + sub_kelas)
  angkatan text not null default '7',
  sub_kelas text default null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  constraint kelas_angkatan_sub_unique unique (angkatan, sub_kelas)
);

-- 3. SISWA_KELAS (Junction)
create table public.siswa_kelas (
  siswa_id uuid references public.users on delete cascade not null,
  kelas_id uuid references public.kelas on delete cascade not null,
  primary key (siswa_id, kelas_id)
);

-- 4. GURU_KELAS (Junction)
create table public.guru_kelas (
  guru_id uuid references public.users on delete cascade not null,
  kelas_id uuid references public.kelas on delete cascade not null,
  primary key (guru_id, kelas_id)
);

-- 5. BAB TABLE
create table public.bab (
  id uuid default uuid_generate_v4() primary key,
  kelas_id uuid references public.kelas on delete cascade not null,
  nomor integer not null,
  judul text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. KONTEN TABLE (E-Materi, LKPD, Bank Soal, Evaluasi)
create table public.konten (
  id uuid default uuid_generate_v4() primary key,
  bab_id uuid references public.bab on delete cascade not null,
  tipe text not null check (tipe in ('emateri', 'lkpd', 'banksoal', 'evaluasi')),
  judul text not null,
  file_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. SOAL TABLE
create table public.soal (
  id uuid default uuid_generate_v4() primary key,
  konten_id uuid references public.konten on delete cascade not null,
  pertanyaan text not null,
  tipe text not null check (tipe in ('pg', 'uraian')),
  kunci_jawaban text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. JAWABAN_SISWA TABLE
create table public.jawaban_siswa (
  id uuid default uuid_generate_v4() primary key,
  soal_id uuid references public.soal on delete cascade not null,
  siswa_id uuid references public.users on delete cascade not null,
  jawaban text not null,
  skor_ai numeric,
  feedback_ai text,
  skor_final numeric,
  status text not null default 'pending_verifikasi' check (status in ('pending_verifikasi', 'final')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. PRESENSI TABLE
create table public.presensi (
  id uuid default uuid_generate_v4() primary key,
  siswa_id uuid references public.users on delete cascade not null,
  kelas_id uuid references public.kelas on delete cascade not null,
  tanggal date not null,
  status text not null check (status in ('masuk', 'izin', 'sakit', 'alpha')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 10. NILAI TABLE
create table public.nilai (
  id uuid default uuid_generate_v4() primary key,
  siswa_id uuid references public.users on delete cascade not null,
  bab_id uuid references public.bab on delete cascade not null,
  pengetahuan numeric default 0,
  kreativitas numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set Row Level Security (RLS) - Basic Policies
alter table public.users enable row level security;
alter table public.kelas enable row level security;
alter table public.siswa_kelas enable row level security;
alter table public.guru_kelas enable row level security;
alter table public.bab enable row level security;
alter table public.konten enable row level security;
alter table public.soal enable row level security;
alter table public.jawaban_siswa enable row level security;
alter table public.presensi enable row level security;
alter table public.nilai enable row level security;

-- Policy: Everyone authenticated can read users
create policy "Authenticated users can read all users" on public.users for select to authenticated using (true);

-- Functions and triggers for automatic user profile creation when someone signs up
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, email, role, nama)
  values (new.id, new.email, 'siswa', split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Tambahan untuk profil siswa
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nisn varchar(20);
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS tanggal_lahir date;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS jenis_kelamin varchar(10) check (jenis_kelamin in ('Laki-laki', 'Perempuan'));
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS nomor_hp varchar(20);

-- Allow guru to delete konten di kelas yang mereka ajar
CREATE POLICY "Guru can delete konten in their kelas" ON public.konten
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.bab b
      JOIN public.guru_kelas gk ON gk.kelas_id = b.kelas_id
      WHERE b.id = konten.bab_id
      AND gk.guru_id = auth.uid()
    )
  );

-- Allow guru to delete bab di kelas yang mereka ajar
CREATE POLICY "Guru can delete bab in their kelas" ON public.bab
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guru_kelas gk
      WHERE gk.kelas_id = bab.kelas_id
      AND gk.guru_id = auth.uid()
    )
  );
