# StreamEly

*[Read in English](README.md)*

StreamEly adalah platform *video-on-demand* (VOD) ringan yang dirancang untuk penggunaan *self-hosted*. Platform ini mengagregasi metadata dari TVmaze dan OMDB untuk menyajikan pustaka film, serial TV, dan anime, yang dipadukan dengan pemutar *iframe* tertanam untuk distribusi konten.

## Arsitektur

```text
                             ┌──▶ [ Vite Dev Server ] (Port 5173)
                             │
[ Client ] ──▶ [ Bun Proxy ] ─┴─▶ [ Elysia.js API ] (Port 3000)
 (HTTPS)                     
```

## Teknologi Utama
- **Gateway**: Bun (*Reverse Proxy* & *HTTPS offloading*)
- **API**: Bun + Elysia.js
- **Client**: Svelte (Vite)
- **Sumber Data**: TVmaze API, OMDB API, Vidsrc

## Fitur Utama
- **Ingesti Konkuren**: Melakukan *bootstrap* 15.000+ entri ke dalam *cache* memori saat server dijalankan.
- **Heuristik Fallback**: Mem-proksi metadata pemeran/kru TVmaze yang hilang ke OMDB secara dinamis.
- **Pemrosesan Sisi Klien**: Mengimplementasikan *pagination* lokal, penyaringan genre, dan rekomendasi berbasis *Jaccard-index*.
- **Proxy Gateway**: Perutean domain lokal HTTPS kustom (`streamely.local`) yang mengabaikan limitasi Vite HMR.
- **Persistensi State**: Menyinkronkan riwayat tontonan dan markah via `localStorage`.

## Pengembangan Lokal

### Prasyarat
- Node.js (v18+)
- Bun (v1.x)
- OS Windows (untuk konfigurasi *daemon*)

### Instalasi & Eksekusi

1. **Instal Dependensi**
   ```bash
   npm run install:all
   ```

2. **Jalankan Layanan**
   Menjalankan API, server Vite, dan *reverse proxy* secara bersamaan.
   ```bash
   npm start
   ```

3. **Akses Aplikasi**
   Buka `https://streamely.local` di peramban (abaikan peringatan sertifikat *self-signed*).

## Daemon Latar Belakang (PM2)

Untuk menjalankan eksekusi sistem di latar belakang secara persisten:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

Untuk memantau atau mengontrol *daemon*:
```bash
pm2 logs StreamEly
pm2 restart StreamEly
pm2 stop StreamEly
pm2 delete StreamEly
```
