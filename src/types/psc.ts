/**
 * PSC 119 (Public Safety Center) Data Contracts
 * Kemenkes RI - Sistem Penanggulangan Gawat Darurat Terpadu (SPGDT)
 */

export interface PscCallItem {
  no: number
  id: number
  id_user?: number
  kode_psc: string
  kd_prop: string
  provinsi: string
  kd_kab?: string
  kabupaten?: string
  nama_psc: string
  kode_pelaporan_panggilan: string
  ticket_id: string
  tgl_pelaporan_panggilan: string
  tanggal_panggilan: string
  jam_pelaporan_panggilan: string
  id_petugas_pelapor?: number | null
  petugas_pelapor?: string | null
  id_extension?: number | null
  extension?: string | null
  id_sumber_panggilan?: number | null
  sumber_panggilan?: string | null
  id_jenis_layanan?: string | number | null
  jenis_layanan?: string | null
  id_kategori_layanan?: string | number | null
  kategori_layanan?: string | null
  id_spesifikasi_layanan?: string | number | null
  spesifikasi_layanan?: string | null
  status_penanganan?: string | null
  status_penanganan_code?: string | null
  tgl_status_penanganan?: string | null
  nama_pelapor?: string | null
  korban?: string | null
  keluhan?: string | null
  id_icd_10?: string | null
  icd_10?: string | null
  id_ambulan?: string | null
  nomor_kendaraan?: string | null
  id_petugas_ambulan?: string | null
  nama_petugas_ambulan?: string | null
  id_petugas_ambulan_lainnya?: string | null
  nama_petugas_ambulan_lainnya?: string | null
  layanan_ambulance?: string | null
  id_rumahsakit_rujukan?: string | null
  rumahsakit_rujukan?: string | null
  waktu_respons?: string | number | null
  waktu_respons_label?: string | null
  cut_off_by?: number | null
  cut_off_by_label?: string | null
  nama_lokasi?: string | null
  alamat?: string | null
  latitude?: string | null
  longitude?: string | null
  telp?: string | null
  keterangan?: string | null
  is_krisis?: number
}

export interface PscCenterItem {
  no: number
  kd_prop: string
  provinsi: string
  kd_kab: string
  kabupaten: string
  jenis_pendaftaran: string
  kepemilikan: string
  kode_psc: string
  nama_psc: string
  status_psc: number
  nomor_sk_pembentukan?: string | null
  tanggal_sk_pembentukan?: string | null
  alamat?: string | null
  latitude?: string | null
  longitude?: string | null
  nama_pimpinan?: string | null
  telepon_pimpinan?: string | null
  email?: string | null
  website?: string | null
  last_update?: string | null
  data_rumahsakit_sarana?: {
    id: number
    kode_satusehat?: string
    nama: string
    telp?: string
    alamat?: string
    nama_subjenis?: string
    latitude?: string
    longitude?: string
  }[]
}

export interface PscMasterItem {
  id: number
  name: string
  category?: string
  description?: string
}

export interface PscStatsSummary {
  totalPanggilan: number
  totalEmergency: number
  totalNonEmergency: number
  totalTrauma: number
  totalNonTrauma: number
  totalAmbulans: number
  totalSelesai: number
  totalDiproses: number
  avgResponseTime: number
  totalPscCenters: number
  kategoriDistribution: { name: string; count: number; percentage: number }[]
  topWilayah: { name: string; count: number; emergency: number; trauma: number }[]
  hourlyTrend: { hour: string; calls: number }[]
}

export interface PscFilterParams {
  kode_psc?: string
  kd_prop?: string
  kd_kab?: string
  jenis_layanan?: string
  kategori_layanan?: string
  status_penanganan?: string
  tahun?: string
  page?: number
  per_page?: number
  search?: string
}

export interface PscPersonnelItem {
  id_user: number
  kode_psc?: string | null
  detail_lengkap: string
  jabatan: string
  status?: number
  relawan_jkel?: string
  relawan_tanggal_lahir?: string
  relawan_id_prov?: number
  relawan_id_kab?: number
  relawan_no_telp?: string
  email?: string
  join_date?: string
  kabupaten?: string
  provinsi?: string
}

export interface PscAmbulanceItem {
  id_ambulan: number | string
  kode_ambulan?: string
  no_kendaraan?: string
  nama_psc?: string
  kode_psc?: string
  status_aktif?: string | number
  vendor_gps?: string
  latitude?: string | null
  longitude?: string | null
  lat?: number
  lng?: number
  tahun?: string
  webservice_api?: string
  assestment_gawat_darurat?: string
}

export interface PscHospitalItem {
  id: number | string
  kode_satusehat?: string
  kode_sarana?: string
  nama: string
  telp?: string
  email?: string
  website?: string
  alamat?: string
  kode_prop?: string
  nama_prop?: string
  kode_kab?: string
  nama_kab?: string
  kode_subjenis?: string
  nama_subjenis?: string
  status_aktif?: string | number
  rujukan?: string
  latitude?: string | null
  longitude?: string | null
  lat?: number
  lng?: number
}

export interface PscCallRecord {
  kode_trans: string
  ticket_id: string
  kode_psc: string
  nama_psc: string
  status_penanganan_code: string
  status_penanganan: string
  jenis_layanan: string
  kategori_layanan?: string
  spesifikasi_layanan?: string
  tanggal_panggilan: string
  jam_pelaporan_panggilan: string
  petugas_pelapor?: string | null
  nama_pelapor?: string | null
  korban?: string | null
  alamat?: string | null
  nama_lokasi?: string | null
  telp?: string | null
  nomor_kendaraan?: string | null
  nama_petugas_ambulan?: string | null
  layanan_ambulance?: string | null
  rumahsakit_rujukan?: string | null
  lat?: number | null
  lng?: number | null
  response_time_minutes?: number | null
  raw_psc?: any
}

