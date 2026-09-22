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
- **Kompatibel Cloudflare Tunnel**: Logika proxy yang kokoh dengan penghapusan header kompresi ganda (mencegah error `ERR_CONTENT_DECODING_FAILED`).
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
   *(Sebagai alternatif, Anda juga dapat mengakses proxy secara langsung di `http://localhost:8000`)*

## Akses Publik (Cloudflare Tunnel)

Proxy StreamEly sudah dikonfigurasi secara khusus agar aman dari konflik encoding saat dihubungkan melalui Cloudflare Tunnel (mencegah error `ERR_CONTENT_DECODING_FAILED`). Untuk mengekspos web lokal Anda ke internet:

1. Instal [cloudflared](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/).
2. Jalankan perintah *quick tunnel* dan arahkan ke port proxy (8000):
   ```bash
   cloudflared tunnel --url http://localhost:8000
   ```
3. Bagikan dan buka aplikasi Anda menggunakan tautan `trycloudflare.com` yang muncul di terminal.


## Daemon Latar Belakang (PM2)

Untuk menjalankan eksekusi sistem di latar belakang secara persisten:

```bash
npm install -g pm2
pm2 start ecosystem.config.js
```

Untuk memantau atau mengontrol *daemon*:
```bash
# Melihat log aplikasi secara langsung (real-time)
pm2 logs StreamEly

# Menyalakan ulang aplikasi
pm2 restart StreamEly

# Menghentikan aplikasi
pm2 stop StreamEly

# Menghapus aplikasi dari sistem PM2
pm2 delete StreamEly
```
