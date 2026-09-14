# Matriks Analisis & Pemanfaatan Endpoint API PSC 119 Kemenkes RI

> **Dokumentasi Resmi Integrasi Sistem Penanggulangan Gawat Darurat Terpadu (SPGDT)**  
> **Base URL:** `https://psc.kemkes.go.id/web_api/v1`  
> **Autentikasi:** Header `TTOKEN: <TOKEN_ENKRIPSI_KEMENKES>`  
> **Format Data:** `POST` (Body: `multipart/form-data`)

---

## 1. Ringkasan Endpoint API

| No | Endpoint | Metode | Deskripsi Data | Volume Data (Live) | Proxy Internal Dashboard |
|:---:|:---|:---:|:---|:---:|:---|
| **1** | `/data-pelaporan-panggilan` | `POST` | Data transaksional tiket panggilan gawat darurat & non-emergency seluruh Indonesia | **>85.000 panggilan** (Tahun 2026 berjalan) | `/api/psc/panggilan` |
| **2** | `/data-psc` | `POST` | Master data seluruh unit PSC 119 se-Indonesia (450 Unit), legalitas SK, kontak, armada, & jejaring RS sarana rujukan | **450 Unit PSC** se-Indonesia | `/api/psc/centers` |
| **3** | `/stats` *(Internal Aggregator)* | `POST`/`GET` | Agregasi statistik real-time, rasio emergency, distribusi kategori, tren per jam, & response time | Agregasi data live dari endpoint panggilan | `/api/psc/stats` |

---

## 2. Matriks Parameter Request (Filter Input)

| Parameter | Endpoint | Tipe | Status | Nilai Contoh | Pemanfaatan di Dashboard |
|:---|:---|:---:|:---:|:---|:---|
| `kode_psc` | Keduanya | `string` | Opsional | `PSC3671`, `PSC9287` | **Kunci Wilayah Otomatis**: Jika pengguna login dengan kode PSC tertentu, dashboard otomatis mengunci data hanya untuk PSC tersebut. |
| `kd_prop` | `/data-pelaporan-panggilan` | `string` | Opsional | `32` (Jabar), `36` (Banten) | Filter cakupan wilayah level provinsi. |
| `kd_kab` | `/data-pelaporan-panggilan` | `string` | Opsional | `3671` (Kota Tangerang) | Filter spesifik ke tingkat Kabupaten / Kota. |
| `status_penanganan` | `/data-pelaporan-panggilan` | `string` | Opsional | `Selesai`, `Diproses`, `Batal` | Memisahkan antrean panggilan aktif vs laporan yang sudah tuntas. |
| `tahun` | `/data-pelaporan-panggilan` | `string` | Opsional | `2026`, `2025` | Filter tahun operasional laporan. |
| `page` | `/data-pelaporan-panggilan` | `number` | Opsional | `1`, `2`, ... | Pagination tabel kejadian & log panggilan. |
| `per_page` | `/data-pelaporan-panggilan` | `number` | Opsional | `10`, `50`, `100` | Mengontrol limit data per fetch untuk optimasi performa. |

---

## 3. Matriks Kamus Data Isian (Payload Response) & Peluang Pemanfaatan

### A. Endpoint `/data-pelaporan-panggilan` (Data Panggilan Gawat Darurat)

| No | Nama Field (API) | Contoh Nilai | Tipe | Makna / Arti Data | Peluang Pemanfaatan & Rekomendasi Dashboard |
|:---:|:---|:---|:---:|:---|:---|
| 1 | `ticket_id` / `kode_pelaporan_panggilan` | `"PSC3671-A8AAE76ED794"` | String | ID Unik Tiket Panggilan | Menampilkan nomor tiket di tabel, pencarian cepat (search bar), dan tracking progress. |
| 2 | `tanggal_panggilan` / `jam_pelaporan_panggilan` | `"15 Sep 2026"`, `"00:33:52"` | String | Waktu presisi pelaporan masuk | Menghitung grafik tren waktu sibuk (*Peak Hours Call Volume*) per jam 00:00 - 23:00. |
| 3 | `kode_psc` & `nama_psc` | `"PSC3671"`, `"AMBULANS SMART 119 Kota Tangerang"` | String | Identitas Unit PSC penanggung jawab | Pelabelan unit pelaksana, filter otomatis unit lokal, dan benchmark performa antar PSC. |
| 4 | `provinsi` & `kabupaten` (`kd_prop`, `kd_kab`) | `"BANTEN"`, `"KOTA TANGERANG"` | String | Hierarki administrasi wilayah | Filter bertingkat (Cascading Filter) dan penguncian hak akses daerah. |
| 5 | `petugas_pelapor` & `extension` | `"Akridisti Dwi Quroti"`, `"51141"` | String | Call-taker / Operator yang menerima telepon | Audit trail operator, statistik produktivitas call-taker, pemantauan extension aktif. |
| 6 | `sumber_panggilan` | `"WHATSAPP CALL CENTER RUJUKAN..."` | String | Saluran masuk pengaduan (119, WA, Aplikasi, Radio) | Diagram Pie/Bar distribusi saluran laporan masuk (*Omnichannel Analytics*). |
| 7 | `jenis_layanan` | `"Emergency"`, `"Non Emergency"` | String | Klasifikasi kegawatdaruratan | Metrik KPI Utama: Rasio Panggilan Gawat Darurat vs Non-Gadar. |
| 8 | `kategori_layanan` | `"KIA"`, `"Trauma"`, `"Medis Non Trauma"`, `"Jiwa"` | String | Kategori medis klinis | Grafik Donut distribusi jenis kasus medis tertinggi untuk kesiapsiagaan nakes spesialis. |
| 9 | `spesifikasi_layanan` | `"KIA - IBU"`, `"Laka Lantas Tunggal"`, `"Serangan Jantung"` | String | Sub-kategori spesifik kejadian | Analisis detail kebutuhan peralatan medis gawat darurat (misal: ventilator, AED, tabung O2). |
| 10 | `status_penanganan` & `status_penanganan_code` | `"Status Diproses"`, `"Selesai"` | String | Status lifecycle tiket penanganan | Kartu Status Real-time: Tiket Masuk, Petugas Meluncur, Ditangani di Lokasi, Dirujuk, Selesai. |
| 11 | `korban` | `"NY ALVI YULIA WAHYUNINGSIH"` | String | Identitas / Nama Pasien Korban | Rekam medis darurat awal saat serah terima pasien ke IGD RS rujukan. |
| 12 | `keluhan` | `"G3P2A0 HAMIL 40MGG DGN KPD..."` | Text | Anamnesa awal / gejala klinis korban | AI Triage Assistant: ringkasan klinis otomatis & panduan SOP pre-hospital care bagi paramedis. |
| 13 | `icd_10` / `id_icd_10` | `"O42.0"` / `"N/A"` | String | Kode Klasifikasi Penyakit Internasional | Standarisasi pelaporan surveilans kesehatan Kemenkes & interoperabilitas SatuSehat. |
| 14 | `nomor_kendaraan` | `"B 1076 CHX"` | String | Plat nomor armada ambulans dispatch | Fleet Management: melacak ambulans mana yang sedang bertugas (*on-duty*) vs *standby*. |
| 15 | `nama_petugas_ambulan` | `"RACHMAT FALANI SIREGAR"` | String | Nama sopir / perawat ambulans | Penugasan tim medis lapangan & waktu respons kru darurat. |
| 16 | `layanan_ambulance` | `"RACHMAT FALANI | B 1076 CHX"` | String | Pasangan armada & petugas | Logbook penggunaan ambulans harian/bulanan. |
| 17 | `rumahsakit_rujukan` | `"RS Mulya"` | String | Fasilitas kesehatan tujuan rujukan | Integrasi jejaring RS: menghitung rumah sakit yang paling sering menerima rujukan gawat darurat. |
| 18 | `waktu_respons` & `waktu_respons_label` | `8` (menit), `"8 Menit"` | Number/String | Response Time penanganan (Call to On-Scene) | **KPI Standar Nasional Kemenkes**: Indikator apakah respon memenuhi SLA (< 15 menit). |
| 19 | `latitude` & `longitude` | `"-6.229163"`, `"106.674983"` | String (Float) | Titik koordinat GPS lokasi kejadian | **GIS Heatmap & Marker Nyata**: Menampilkan pin kejadian di peta dengan warna sesuai kedaruratan (P1 Merah, P2 Kuning, P3 Hijau). |
| 20 | `nama_lokasi` & `alamat` | `"PUSKESMAS KUNCIRAN LAMA"` | String | Titik penjemputan / TKP kejadian | Informasi navigasi rute evakuasi bagi armada ambulans. |

---

### B. Endpoint `/data-psc` (Master Registry Unit PSC & Faskes Jejaring)

| No | Nama Field (API) | Contoh Nilai | Tipe | Makna / Arti Data | Peluang Pemanfaatan & Rekomendasi Dashboard |
|:---:|:---|:---|:---:|:---|:---|
| 1 | `kode_psc` & `nama_psc` | `"PSC9362"`, `"PSC 119 SAROMASE SIDENRENG RAPPANG"` | String | Kode & Nama Resmi Unit PSC | Master dropdown unit PSC seluruh Indonesia (450 Unit). |
| 2 | `kd_prop`, `provinsi`, `kd_kab`, `kabupaten` | `"73"`, `"SULAWESI SELATAN"`, `"7314"`, `"SIDENRENG RAPPANG"` | String | Wilayah teritori kerja PSC | **Auto-Lock Binding**: Membaca otomatis wilayah berdasarkan `kode_psc` saat login. |
| 3 | `jenis_pendaftaran` & `kepemilikan` | `"PSC"`, `"Pemerintah Kab/Kota"` | String | Status legalitas lembaga | Verifikasi keabsahan unit & tipe kepemilikan (Pemda vs Swasta). |
| 4 | `nomor_sk_pembentukan` & `tanggal_sk_pembentukan` | `"4a Tahun 2026"`, `"2026-01-02"` | String | Dasar hukum operasional SK Bupati/Walikota | Profil legalitas unit PSC di halaman detail profil dan unduh laporan. |
| 5 | `nama_pimpinan` & `telepon_pimpinan` | `"H. Andi M."`, `"0812xxxx"` | String | Kontak penanggung jawab unit | Direktori darurat antar-PSC (Koneksi koordinasi rujukan antar wilayah / lintas daerah). |
| 6 | `latitude` & `longitude` | `"-3.85817"`, `"119.81759"` | Float | Koordinat Markas / Command Center PSC | Menampilkan icon Markas PSC 119 di peta GIS. |
| 7 | `data_rumahsakit_sarana` (Array) | `[{"nama": "RS Adinda Medical", "kode_satusehat": "1000720234", "telp": "0852...", "latitude": "-3.858", "longitude": "119.81"}]` | Array of Objects | Daftar RS jejaring rujukan terdaftar lengkap dengan ID SatuSehat & GPS | **Peta Jejaring RS Rujukan**: Menampilkan titik RS di sekitar wilayah PSC, kontak IGD RS, serta integrasi ID SatuSehat untuk rujukan digital! |
| 8 | `data_extension` & `data_sumber_panggilan` | `Array` | Array of Objects | Master extension dan kanal pendaftaran panggilan | Sinkronisasi master data pendaftaran tiket baru. |

---

## 4. Matriks Rekomendasi Improvement Dashboard Berdasarkan Data API

| Area Dashboard | Fitur Saat Ini (Eks-Bencana) | Rekomendasi Fitur Baru (Berbasis API PSC) | Data API yang Dimanfaatkan | Nilai Tambah (Business Value) |
|:---|:---|:---|:---|:---|
| **1. Popup Peta Wilayah** | Menampilkan metrik bencana: *"Meninggal, Luka-luka, Pengungsi, Populasi Terdampak"* | Menampilkan metrik operasional darurat: **Total Panggilan Masuk, Kasus Gadar (P1), Armada Ambulans Bergerak, dan Kasus Selesai Ditangani** | `jenis_layanan`, `kategori_layanan`, `status_penanganan`, `nomor_kendaraan` | Relevan 100% dengan tugas pokok PSC 119; menghilangkan terminologi bencana alam yang membingungkan operator. |
| **2. Filter Wilayah Otomatis (Auto-Lock)** | Bebas memilih provinsi dan kabupaten mana saja tanpa batasan | Ketika operator login atau membawa parameter `?kode_psc=PSCxxxx`, dropdown **Provinsi & Kabupaten langsung otomatis terpilih & terkunci (*locked*)**, hanya filter Waktu (Bulan/Tahun) yang aktif | `kd_prop`, `kd_kab`, `kode_psc` dari `/data-psc` | Menjamin keamanan data (*data isolation*), operator daerah fokus pada teritorinya masing-masing tanpa melihat data rahasia daerah lain. |
| **3. Peta Interaktif (GIS Mapping)** | Peta statis polygon kasar | **Peta Sebaran Insiden Real GPS & Marker RS Rujukan**: Menampilkan titik kejadian gawat darurat dan rumah sakit jejaring terdekat | `latitude`, `longitude`, `rumahsakit_rujukan`, `data_rumahsakit_sarana` | Command Center dapat melihat visualisasi spasial langsung titik gawat darurat dan menentukan faskes rujukan terdekat secara presisi. |
| **4. Response Time SLA Tracker** | Tidak ada | **Dashboard Response Time (< 15 Menit)**: Indikator persentase ketercapaian SPM (*Standar Pelayanan Minimal*) Response Time Kemenkes | `waktu_respons`, `waktu_respons_label`, `jam_pelaporan_panggilan` | Menjadi tolok ukur evaluasi kinerja pelayanan PSC 119 di hadapan Dinas Kesehatan dan Kemenkes RI. |
| **5. Manajemen Armada & Tim Medis** | Tidak ada | **Ambulance & Crew Dispatch Monitoring**: Tabel armada yang sedang bertugas (*on the road*) beserta nama perawat/sopir dan nomor polisi | `nomor_kendaraan`, `nama_petugas_ambulan`, `layanan_ambulance` | Mencegah armada ganda dan memastikan transparansi penugasan ambulans darurat. |
| **6. Analisis Kasus Klinis (Kategori & ICD-10)** | Kasus Bencana | **Kategori Medis Gadar**: KIA (Kesehatan Ibu & Anak), Kecelakaan Lalu Lintas, Medis Kardiovaskular, Psikiatri/Jiwa | `kategori_layanan`, `spesifikasi_layanan`, `icd_10`, `keluhan` | Memberikan *early warning* kepada rumah sakit rujukan terhadap jenis kasus medis darurat yang sedang dalam perjalanan menuju IGD. |
| **7. Analisis Kanal Laporan (Omnichannel)** | Statis | **Distribusi Sumber Panggilan**: Perbandingan trafik dari Telepon 119 Nasional, WhatsApp Dinkes, Aplikasi Mobile, dan Radio Medis | `sumber_panggilan`, `extension` | Mengidentifikasi kanal komunikasi mana yang paling sering digunakan masyarakat untuk alokasi kapasitas server/operator. |
| **8. Integrasi SATUSEHAT** | Tidak ada | **Verifikasi RS Rujukan & Kode SATUSEHAT**: Menampilkan kode RS SatuSehat untuk persiapan interoperabilitas rekam medis digital | `data_rumahsakit_sarana[].kode_satusehat` | Memenuhi mandat regulasi Kemenkes RI tentang integrasi ekosistem SatuSehat. |
