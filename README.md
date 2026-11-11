# Nihongo Study

Aplikasi latihan Kotoba & Kanji bahasa Jepang (Minna no Nihongo I–II, Irodori 入門 / 初級1 / 初級2),
dengan simulasi JLPT N5/N4, koin, toko chest, dan koleksi tampilan.
Bisa di-install di HP dan dibuka tanpa internet. Progres tersimpan di perangkat masing-masing.

## Isi folder
| File | Fungsi |
|---|---|
| `index.html` | Aplikasinya (semua data & kode ada di sini) |
| `manifest.webmanifest` | Nama, warna, dan ikon aplikasi saat di-install |
| `sw.js` | Supaya bisa dibuka offline dan update otomatis |
| `icon-192.png`, `icon-512.png` | Ikon aplikasi |

## A. Upload ke GitHub Pages (pertama kali)
1. Login di https://github.com lalu klik **New** (repository baru).
2. Isi nama, misalnya `nihongo-study`. Pilih **Public** (GitHub Pages gratis butuh repo publik). Klik **Create repository**.
3. Di halaman repo, klik **uploading an existing file** (atau **Add file → Upload files**).
4. Seret **kelima file** di atas (boleh sekalian README.md). Klik **Commit changes**.
5. Buka **Settings → Pages**. Di *Build and deployment*, pilih **Source: Deploy from a branch**,
   **Branch: main**, folder **/ (root)**, lalu **Save**.
6. Tunggu 1–2 menit. Alamat aplikasinya muncul di halaman yang sama:
   `https://USERNAME.github.io/nihongo-study/`

## B. Cara murid meng-install
- **Android (Chrome):** buka alamatnya → menu titik tiga → **Instal aplikasi** / **Tambahkan ke layar utama**.
- **iPhone (Safari):** buka alamatnya → tombol **Bagikan** → **Tambah ke Layar Utama**.
- **Laptop (Chrome/Edge):** klik ikon instal di ujung kanan kolom alamat.

## C. Cara update
1. Di repo, klik **Add file → Upload files**, seret `index.html` versi baru, klik **Commit changes**.
2. Tunggu 1–2 menit. Murid dapat versi baru saat membuka aplikasi dengan internet menyala
   (kadang perlu ditutup lalu dibuka sekali lagi).
3. Nomor versi terlihat di bagian bawah Beranda.

## D. Supaya progres murid tidak hilang
- Jangan ganti **nama repo** atau **username** GitHub setelah dibagikan: alamat berubah = progres mulai dari nol.
- Jangan ubah `SAVE_KEY` di dalam `index.html`.
- Progres hilang kalau murid menghapus data browser atau uninstall. Untuk jaga-jaga:
  menu **Koleksi → Cadangkan / pulihkan progres** → salin kodenya.
