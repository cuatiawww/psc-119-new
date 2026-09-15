# psc-119-new

Dashboard & AI Intelligence Template berbasis Next.js, React, TypeScript, dan Tailwind CSS.

## Fitur Utama
- **Dashboard Spasial**: Visualisasi peta pemantauan spasial kejadian bencana & krisis kesehatan (auto layout full-width).
- **Template AI Intelligence**:
  - Sintesis laporan eksekutif via Google Gemini AI (`/api/generate-dashboard-report-ai`).
  - Mode Pantauan EOC (Command Center Video Wall / TV).
- **Arsitektur Siap Integrasi**: Siap dihubungkan ke endpoint API backend baru melalui konfigurasi environment.

## Memulai Proyek

1. **Instalasi Dependencies**
   ```bash
   npm install
   ```

2. **Konfigurasi Environment**
   Salin `.env.example` ke `.env.local`:
   ```bash
   cp .env.example .env.local
   ```
   Isi konfigurasi yang dibutuhkan (misal `GEMINI_API_KEY`, `NEXT_PUBLIC_API_BASE_URL`).

3. **Menjalankan Mode Development**
   ```bash
   npm run dev
   ```
   Buka [http://localhost:3000/dashboard](http://localhost:3000/dashboard) pada peramban Anda.
