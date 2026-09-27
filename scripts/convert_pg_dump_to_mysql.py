#!/usr/bin/env python3
"""Convert the public-schema COPY data in a plain pg_dump to MySQL SQL."""

from __future__ import annotations

import argparse
import re
from pathlib import Path

TABLES = {
    "users": """CREATE TABLE `users` (
  `id` CHAR(36) NOT NULL,
  `email` VARCHAR(320) NOT NULL,
  `role` ENUM('admin','guru','siswa') NOT NULL,
  `nama` TEXT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `nisn` VARCHAR(20) NULL,
  `tanggal_lahir` DATE NULL,
  `jenis_kelamin` VARCHAR(10) NULL,
  `nomor_hp` VARCHAR(20) NULL,
  `tahun_ajaran` VARCHAR(10) NULL,
  `foto_profil_url` TEXT NULL,
  `nama_wali` TEXT NULL,
  `alamat` TEXT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "kelas": """CREATE TABLE `kelas` (
  `id` CHAR(36) NOT NULL,
  `nama` TEXT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `angkatan` VARCHAR(20) NOT NULL DEFAULT '7',
  `sub_kelas` VARCHAR(10) NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `kelas_angkatan_sub_unique` (`angkatan`, `sub_kelas`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "bab": """CREATE TABLE `bab` (
  `id` CHAR(36) NOT NULL,
  `kelas_id` CHAR(36) NOT NULL,
  `nomor` INT NOT NULL,
  `judul` TEXT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_bab_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "forum_belajar": """CREATE TABLE `forum_belajar` (
  `id` CHAR(36) NOT NULL,
  `bab_id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `pesan` LONGTEXT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_forum_belajar_bab` FOREIGN KEY (`bab_id`) REFERENCES `bab` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_forum_belajar_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "guru_kelas": """CREATE TABLE `guru_kelas` (
  `guru_id` CHAR(36) NOT NULL,
  `kelas_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`guru_id`, `kelas_id`),
  CONSTRAINT `fk_guru_kelas_user` FOREIGN KEY (`guru_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_guru_kelas_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "hari": """CREATE TABLE `hari` (
  `id` CHAR(36) NOT NULL,
  `nama` VARCHAR(30) NOT NULL,
  `urutan` INT NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `hari_nama_unique` (`nama`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "jadwal": """CREATE TABLE `jadwal` (
  `id` CHAR(36) NOT NULL,
  `guru_id` CHAR(36) NOT NULL,
  `kelas_id` CHAR(36) NOT NULL,
  `hari` VARCHAR(30) NOT NULL,
  `jam_mulai` TIME NOT NULL,
  `jam_selesai` TIME NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_jadwal_guru` FOREIGN KEY (`guru_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_jadwal_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "jawaban_siswa": """CREATE TABLE `jawaban_siswa` (
  `id` CHAR(36) NOT NULL,
  `soal_id` CHAR(36) NOT NULL,
  `siswa_id` CHAR(36) NOT NULL,
  `jawaban` LONGTEXT NOT NULL,
  `skor_ai` DECIMAL(30,10) NULL,
  `feedback_ai` LONGTEXT NULL,
  `skor_final` DECIMAL(30,10) NULL,
  `status` ENUM('pending_verifikasi','final') NOT NULL DEFAULT 'pending_verifikasi',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `file_url` TEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_jawaban_siswa_soal` FOREIGN KEY (`soal_id`) REFERENCES `soal` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_jawaban_siswa_user` FOREIGN KEY (`siswa_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "jawaban_ujian": """CREATE TABLE `jawaban_ujian` (
  `id` CHAR(36) NOT NULL,
  `soal_id` CHAR(36) NOT NULL,
  `siswa_id` CHAR(36) NOT NULL,
  `jawaban_teks` LONGTEXT NULL,
  `foto_url` TEXT NULL,
  `skor_ai` DECIMAL(10,2) NULL,
  `feedback_ai` LONGTEXT NULL,
  `skor_final` DECIMAL(10,2) NULL,
  `dinilai_at` DATETIME(6) NULL,
  `status` ENUM('pending_verifikasi','final') NOT NULL DEFAULT 'pending_verifikasi',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_jawaban_ujian_soal` FOREIGN KEY (`soal_id`) REFERENCES `soal_ujian` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_jawaban_ujian_user` FOREIGN KEY (`siswa_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "soal_ujian_kunci": """CREATE TABLE `soal_ujian_kunci` (
  `soal_id` CHAR(36) NOT NULL,
  `kunci_jawaban` LONGTEXT NOT NULL,
  `pembahasan` LONGTEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`soal_id`),
  CONSTRAINT `fk_soal_ujian_kunci_soal` FOREIGN KEY (`soal_id`) REFERENCES `soal_ujian` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "konten": """CREATE TABLE `konten` (
  `id` CHAR(36) NOT NULL,
  `bab_id` CHAR(36) NOT NULL,
  `tipe` ENUM('emateri','lkpd','banksoal','evaluasi') NOT NULL,
  `judul` TEXT NOT NULL,
  `file_url` TEXT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `deadline` DATETIME(6) NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_konten_bab` FOREIGN KEY (`bab_id`) REFERENCES `bab` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "laporan": """CREATE TABLE `laporan` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `role` ENUM('guru','siswa') NOT NULL,
  `deskripsi` LONGTEXT NOT NULL,
  `status` ENUM('menunggu','selesai') NOT NULL DEFAULT 'menunggu',
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_laporan_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "nilai": """CREATE TABLE `nilai` (
  `id` CHAR(36) NOT NULL,
  `siswa_id` CHAR(36) NOT NULL,
  `bab_id` CHAR(36) NOT NULL,
  `pengetahuan` DECIMAL(30,10) NULL DEFAULT 0,
  `kreativitas` DECIMAL(30,10) NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `skor_benar` DECIMAL(30,10) NULL,
  `skor_presensi` DECIMAL(30,10) NULL,
  `nilai_akhir` DECIMAL(30,10) NULL,
  `umpan_balik` LONGTEXT NULL,
  `umpan_balik_foto_url` TEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `nilai_siswa_bab_unique` (`siswa_id`, `bab_id`),
  CONSTRAINT `fk_nilai_user` FOREIGN KEY (`siswa_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_nilai_bab` FOREIGN KEY (`bab_id`) REFERENCES `bab` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "notifikasi": """CREATE TABLE `notifikasi` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `pesan` LONGTEXT NOT NULL,
  `is_read` TINYINT(1) NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_notifikasi_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "pengaturan": """CREATE TABLE `pengaturan` (
  `id` CHAR(36) NOT NULL,
  `nama_sekolah` TEXT NULL,
  `alamat` TEXT NULL,
  `kop_surat` LONGTEXT NULL,
  `latitude_pusat` DECIMAL(30,10) NULL,
  `longitude_pusat` DECIMAL(30,10) NULL,
  `radius_meter` INT NULL DEFAULT 50,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "presensi": """CREATE TABLE `presensi` (
  `id` CHAR(36) NOT NULL,
  `siswa_id` CHAR(36) NOT NULL,
  `kelas_id` CHAR(36) NOT NULL,
  `tanggal` DATE NOT NULL,
  `status` ENUM('masuk','izin','sakit','alpha') NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `latitude` DECIMAL(30,10) NULL,
  `longitude` DECIMAL(30,10) NULL,
  `status_validasi` ENUM('pending','valid','invalid') NULL DEFAULT 'pending',
  `feedback_guru` LONGTEXT NULL,
  `foto_url` TEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_presensi_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_presensi_user` FOREIGN KEY (`siswa_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "siswa_kelas": """CREATE TABLE `siswa_kelas` (
  `siswa_id` CHAR(36) NOT NULL,
  `kelas_id` CHAR(36) NOT NULL,
  PRIMARY KEY (`siswa_id`, `kelas_id`),
  CONSTRAINT `fk_siswa_kelas_user` FOREIGN KEY (`siswa_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_siswa_kelas_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "slot_jam": """CREATE TABLE `slot_jam` (
  `id` CHAR(36) NOT NULL,
  `jam_mulai` TIME NOT NULL,
  `jam_selesai` TIME NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `slot_jam_times_unique` (`jam_mulai`, `jam_selesai`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "soal": """CREATE TABLE `soal` (
  `id` CHAR(36) NOT NULL,
  `konten_id` CHAR(36) NOT NULL,
  `pertanyaan` LONGTEXT NOT NULL,
  `tipe` ENUM('pg','uraian') NOT NULL,
  `kunci_jawaban` LONGTEXT NOT NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `butuh_upload` TINYINT(1) NULL DEFAULT 0,
  `lampiran_url` TEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_soal_konten` FOREIGN KEY (`konten_id`) REFERENCES `konten` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "soal_ujian": """CREATE TABLE `soal_ujian` (
  `id` CHAR(36) NOT NULL,
  `ujian_id` CHAR(36) NOT NULL,
  `pertanyaan` LONGTEXT NOT NULL,
  `tipe` ENUM('pg','uraian') NOT NULL DEFAULT 'uraian',
  `opsi` JSON NULL,
  `multi_jawaban` TINYINT(1) NOT NULL DEFAULT 0,
  `butuh_foto_jawaban` TINYINT(1) NULL DEFAULT 0,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `lampiran_url` TEXT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_soal_ujian_ujian` FOREIGN KEY (`ujian_id`) REFERENCES `ujian` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
    "ujian": """CREATE TABLE `ujian` (
  `id` CHAR(36) NOT NULL,
  `guru_id` CHAR(36) NOT NULL,
  `kelas_id` CHAR(36) NOT NULL,
  `jenis` ENUM('UH','UTS','UAS') NOT NULL,
  `deskripsi` LONGTEXT NULL,
  `durasi_menit` INT NOT NULL,
  `mulai_at` DATETIME(6) NULL,
  `selesai_at` DATETIME(6) NULL,
  `is_terbit` TINYINT(1) NOT NULL DEFAULT 0,
  `bab_id` CHAR(36) NULL,
  `created_at` DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_ujian_guru` FOREIGN KEY (`guru_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_ujian_kelas` FOREIGN KEY (`kelas_id`) REFERENCES `kelas` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;""",
}

COPY_RE = re.compile(r"^COPY public\.(\w+) \((.*?)\) FROM stdin;$")
BOOLEAN_COLUMNS = {"is_read", "butuh_upload", "butuh_foto_jawaban", "multi_jawaban", "is_terbit"}


def decode_copy_field(value: str) -> str | None:
    if value == r"\N":
        return None

    output: list[str] = []
    index = 0
    escapes = {"b": "\b", "f": "\f", "n": "\n", "r": "\r", "t": "\t", "v": "\v", "\\": "\\"}
    while index < len(value):
        char = value[index]
        if char != "\\":
            output.append(char)
            index += 1
            continue

        index += 1
        if index >= len(value):
            output.append("\\")
            break

        escaped = value[index]
        if escaped in escapes:
            output.append(escapes[escaped])
            index += 1
        elif escaped in "01234567":
            digits = value[index:index + 3]
            output.append(chr(int(digits, 8)))
            index += len(digits)
        elif escaped == "x" and index + 1 < len(value):
            match = re.match(r"[0-9A-Fa-f]{1,2}", value[index + 1:])
            if match:
                output.append(chr(int(match.group(0), 16)))
                index += 1 + len(match.group(0))
            else:
                output.append("x")
                index += 1
        else:
            output.append(escaped)
            index += 1

    return "".join(output)


def mysql_value(table: str, column: str, value: str | None) -> str:
    if value is None:
        return "NULL"
    if column in BOOLEAN_COLUMNS:
        if value == "t":
            return "1"
        if value == "f":
            return "0"
        raise ValueError(f"Unexpected boolean value for {table}.{column}: {value!r}")
    encoded = value.encode("utf-8").hex()
    return f"CONVERT(X'{encoded}' USING utf8mb4)"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", nargs="?", default="backup.sql", help="plain-text pg_dump input")
    parser.add_argument("output", nargs="?", default="backups/appmath_mysql_import.sql", help="MySQL SQL output")
    args = parser.parse_args()

    source = Path(args.input)
    lines = source.read_text(encoding="utf-8").splitlines()
    data: dict[str, tuple[list[str], list[list[str | None]]]] = {}

    index = 0
    while index < len(lines):
        match = COPY_RE.match(lines[index])
        if not match:
            index += 1
            continue
        table = match.group(1)
        if table not in TABLES:
            raise ValueError(f"No MySQL schema mapping for public.{table}")
        columns = [column.strip() for column in match.group(2).split(",")]
        rows: list[list[str | None]] = []
        index += 1
        while index < len(lines) and lines[index] != r"\.":
            fields = lines[index].split("\t")
            if len(fields) != len(columns):
                raise ValueError(
                    f"public.{table} row {len(rows) + 1}: expected {len(columns)} fields, got {len(fields)}"
                )
            rows.append([decode_copy_field(field) for field in fields])
            index += 1
        if index >= len(lines):
            raise ValueError(f"Unterminated COPY block for public.{table}")
        expected_columns = re.findall(
          r"^  `([^`]+)` ",
          TABLES[table].split("PRIMARY KEY", 1)[0],
          flags=re.MULTILINE,
        )
        if columns != expected_columns:
            raise ValueError(f"Column mismatch for public.{table}: {columns!r}")
        data[table] = (columns, rows)
        index += 1

    if set(data) != set(TABLES):
        missing = sorted(set(TABLES) - set(data))
        extra = sorted(set(data) - set(TABLES))
        raise ValueError(f"Public table coverage mismatch; missing={missing}, extra={extra}")

    output: list[str] = [
        "-- Converted from a Supabase/PostgreSQL public-schema dump for MySQL/phpMyAdmin.",
        "-- Select an EMPTY MySQL database before importing this file.",
        "-- Auth accounts, PostgreSQL functions/triggers, RLS policies, and Storage objects are not included.",
        "-- PostgreSQL timestamptz values are imported as UTC DATETIME(6).",
        "SET NAMES utf8mb4;",
        "SET FOREIGN_KEY_CHECKS = 0;",
        "",
    ]
    output.extend(TABLES.values())
    output.extend(["", "-- Data: values are hex-encoded to preserve tabs, quotes, backslashes, and newlines."])

    total_rows = 0
    for table, (columns, rows) in data.items():
        if not rows:
            continue
        total_rows += len(rows)
        quoted_columns = ", ".join(f"`{column}`" for column in columns)
        for start in range(0, len(rows), 100):
            batch = rows[start:start + 100]
            output.append(f"INSERT INTO `{table}` ({quoted_columns}) VALUES")
            rendered_rows = [
                "(" + ", ".join(mysql_value(table, column, value) for column, value in zip(columns, row)) + ")"
                for row in batch
            ]
            output.append(",\n".join(rendered_rows) + ";")
            output.append("")

    output.extend(["SET FOREIGN_KEY_CHECKS = 1;", ""])
    destination = Path(args.output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text("\n".join(output), encoding="utf-8")
    print(f"Converted {len(data)} public tables and {total_rows} rows.")
    print(f"MySQL import SQL: {destination}")


if __name__ == "__main__":
    main()
