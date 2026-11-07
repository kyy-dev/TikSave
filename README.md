# TikSave

TikSave menyediakan antarmuka browser untuk fitur di `@tobyg74/tiktok-api-dl`. Proses pengambilan data berjalan di server Node.js lokal, jadi pengguna tidak perlu menjalankan perintah CLI.

## Menjalankan website

```powershell
npm install
npm start
```

Buka `http://127.0.0.1:3000`. Secara default server hanya menerima koneksi dari komputer yang sama. `PORT` dan `HOST` dapat diatur melalui environment variable.

Jangan membuka server ke jaringan publik tanpa menambahkan autentikasi dan perlindungan yang sesuai. Cookie TikTok yang dimasukkan di formulir diteruskan ke server lokal untuk permintaan tersebut, tidak disimpan oleh TikSave.

## Fitur

- Download utama: video tanpa watermark, video dengan watermark, dan lagu jika tautannya tersedia
- Download foto slide
- Fitur opsional yang sudah ada: pencarian, profil, komentar, postingan, repost, video disukai, koleksi, playlist, trending, dan pencarian musik

Fitur opsional ditandai "Coming soon" selagi antarmukanya disempurnakan. Fitur tersebut tetap bisa dicoba, dan respons JSON tetap tersedia.

Hasil menampilkan pilihan download yang ditemukan dan respons JSON lengkap. Tautan media dibuka dari browser; kemampuan menyimpan berkas bergantung pada browser dan sumber media.

Pencarian, video yang disukai, dan detail musik meminta cookie TikTok sesuai kebutuhan library. Masukkan cookie hanya pada server yang Anda jalankan sendiri. Ketersediaan hasil mengikuti API dan perubahan layanan TikTok.

## Pengujian

```powershell
npm test
```

Untuk memeriksa website dan API tanpa mengirim permintaan ke TikTok:

```powershell
node test.js
```

Server harus berjalan lebih dulu. URL server dapat diberikan sebagai argumen, misalnya `node test.js http://127.0.0.1:3000`.
