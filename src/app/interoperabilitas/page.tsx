'use client'

import { useState, useMemo } from 'react'
import { useAuthStore } from '@/lib/authStore'
import {
  Network,
  Activity,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Clock,
  ArrowLeft,
  ExternalLink,
  Info,
  Server,
  Database,
  ArrowRight,
  ShieldCheck,
  FileSpreadsheet,
} from 'lucide-react'
import Link from 'next/link'

export default function InteroperabilityPage() {
  const { user } = useAuthStore()
  const [syncingAll, setSyncingAll] = useState(false)
  const [syncStatus, setSyncStatus] = useState<Record<string, 'idle' | 'syncing' | 'success'>>({
    sisdmk: 'idle',
    aspak: 'idle',
    smile: 'idle',
    komdat: 'idle',
    regpus: 'idle',
  })

  const triggerSync = (system: string) => {
    setSyncStatus(prev => ({ ...prev, [system]: 'syncing' }))
    setTimeout(() => {
      setSyncStatus(prev => ({ ...prev, [system]: 'success' }))
      setTimeout(() => {
        setSyncStatus(prev => ({ ...prev, [system]: 'idle' }))
      }, 2000)
    }, 1500)
  }

  const triggerSyncAll = () => {
    setSyncingAll(true)
    Object.keys(syncStatus).forEach(sys => {
      setSyncStatus(prev => ({ ...prev, [sys]: 'syncing' }))
    })

    setTimeout(() => {
      Object.keys(syncStatus).forEach(sys => {
        setSyncStatus(prev => ({ ...prev, [sys]: 'success' }))
      })
      setSyncingAll(false)

      setTimeout(() => {
        Object.keys(syncStatus).forEach(sys => {
          setSyncStatus(prev => ({ ...prev, [sys]: 'idle' }))
        })
      }, 2000)
    }, 2000)
  }

  const systems = [
    {
      id: 'sisdmk',
      name: 'SISDMK / DREAMS',
      fullname: 'Sistem Informasi Sumber Daya Manusia Kesehatan',
      type: 'API Integrasi',
      method: 'GET',
      endpoint: 'https://api.kemkes.go.id/v1/sisdmk/faskes/7505001',
      schedule: 'Setiap tanggal 1 (Bulanan)',
      variables: 'SDM Kesehatan (Kelengkapan 4 Jenis, 9 Jenis, dan 11 Jenis Tenaga Medis/Kesehatan)',
      status: 'Terhubung',
      lastSync: '01 Juli 2026 00:05 WIB',
      recordCount: '6.566 Faskes Terpetakan',
      color: 'teal',
    },
    {
      id: 'aspak',
      name: 'ASPAK',
      fullname: 'Aplikasi Sarana, Prasarana, dan Alat Kesehatan',
      type: 'API Integrasi',
      method: 'GET',
      endpoint: 'https://aspak.kemkes.go.id/api/v2/monitoring/kelayakan-spa',
      schedule: 'Setiap tanggal 6 (Bulanan)',
      variables: 'SPA (Persentase kelayakan minimal 60% Sarana, Prasarana, dan Alat Kesehatan)',
      status: 'Terhubung',
      lastSync: '26 Juni 2026 04:12 WIB',
      recordCount: '2.645 Faskes Terpetakan',
      color: 'teal',
    },
    {
      id: 'smile',
      name: 'SMILE System',
      fullname: 'Sistem Monitoring Imunisasi dan Logistik secara Elektronik',
      type: 'Unggahan Data',
      method: 'Excel Aliran Data',
      schedule: 'Awal Bulan',
      variables: 'PERBEKES (Ketersediaan 40 jenis obat esensial dan BMHP CKG di tingkat Puskesmas)',
      status: 'Perlu Sinkronisasi',
      lastSync: '02 Juni 2026 14:35 WIB',
      recordCount: '1.102 Logistik Obat Valid',
      color: 'amber',
    },
    {
      id: 'komdat',
      name: 'KOMDAT',
      fullname: 'Aplikasi Komunikasi Data Kesehatan Kemenkes',
      type: 'Unggahan Data',
      method: 'Excel Aliran Data',
      schedule: 'Setiap tanggal 6 (Bulanan)',
      variables: 'Tata Kelola (Status BLUD, integrasi ILP, penilaian kinerja PKP, dan 10 Penyakit Terbanyak)',
      status: 'Terhubung',
      lastSync: '26 Juni 2026 08:30 WIB',
      recordCount: '7.406 Faskes Berstatus BLUD',
      color: 'teal',
    },
    {
      id: 'regpus',
      name: 'REGPUS',
      fullname: 'Registrasi Puskesmas Pusat',
      type: 'Sinkronisasi Database',
      method: 'Database Link (Regpus Server)',
      schedule: 'Real-time / Harian',
      variables: 'Profil Faskes, Status Pelayanan (Ranap/Non Ranap), Perizinan Operasional, dan Kategori Wilayah',
      status: 'Terhubung',
      lastSync: '02 Juli 2026 06:00 WIB',
      recordCount: '9.831 Profil Puskesmas Aktif',
      color: 'teal',
    },
  ]

  const syncLogs = [
    { time: '02 Jul 2026 06:00', system: 'REGPUS', action: 'Sync Database', status: 'Sukses', records: '9.831 records', duration: '12.4s' },
    { time: '01 Jul 2026 00:05', system: 'SISDMK / DREAMS', action: 'API Pull', status: 'Sukses', records: '6.566 records', duration: '45.1s' },
    { time: '26 Jun 2026 08:30', system: 'KOMDAT', action: 'Excel Import', status: 'Sukses', records: '7.406 records', duration: '8.2s' },
    { time: '26 Jun 2026 04:12', system: 'ASPAK', action: 'API Pull', status: 'Sukses', records: '2.645 records', duration: '31.8s' },
    { time: '02 Jun 2026 14:35', system: 'SMILE System', action: 'Excel Import', status: 'Sukses', records: '1.102 records', duration: '5.9s' },
  ]

  return (
    <div className="w-full space-y-6 px-4 py-6 sm:px-6 lg:px-8 bg-[#fbffff] min-h-screen">
      <div className="w-full space-y-8">

        {/* Navigation Breadcrumb & Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-200/60 pb-5 gap-4">
          <nav className="flex text-sm sm:text-base font-bold uppercase tracking-wider text-slate-400 gap-2 items-center">
            <Link href="/" className="hover:text-[#047D78] transition-colors">BERANDA</Link>
            <span className="text-slate-300">/</span>
            <span className="text-[#047D78]">INTEROPERABILITAS DATA</span>
          </nav>

          <button
            onClick={triggerSyncAll}
            disabled={syncingAll}
            className="flex items-center justify-center gap-2.5 rounded-xl bg-[#047D78] hover:bg-[#036662] text-white px-6 py-3.5 text-sm font-black uppercase tracking-wider transition-all hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-75 disabled:cursor-wait shrink-0"
          >
            <RefreshCw className={`h-4 w-4 ${syncingAll ? 'animate-spin' : ''}`} />
            <span>{syncingAll ? 'Sinkronisasi Semua...' : 'Sinkronkan Semua Sistem'}</span>
          </button>
        </div>

        {/* Systems Matrix Table */}
        <div className="space-y-4">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider">Matriks Integrasi Sistem Vertikal</h2>
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[1000px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-450 font-bold uppercase tracking-wider text-[11.5px] bg-slate-50/50">
                  <th className="py-3.5 px-4 rounded-l-xl">Sistem Vertikal (Kemenkes)</th>
                  <th className="py-3.5 px-4 w-[35%]">Variabel Monitoring Terkait</th>
                  <th className="py-3.5 px-4">Mekanisme Aliran Data</th>
                  <th className="py-3.5 px-4">Jadwal Sinkronisasi</th>
                  <th className="py-3.5 px-4 text-center">Status & Sinkronisasi Terakhir</th>
                  <th className="py-3.5 px-4 text-center rounded-r-xl">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-750">
                {systems.map((sys) => {
                  const status = syncStatus[sys.id]
                  return (
                    <tr key={sys.id} className="hover:bg-slate-50/40 transition-colors">
                      {/* Name & Full Name */}
                      <td className="py-5 px-4">
                        <div className="flex items-center gap-2">
                          <span className={`h-2.5 w-2.5 rounded-full shrink-0 ${sys.color === 'teal' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                          <span className="text-base font-black text-slate-900">{sys.name}</span>
                        </div>
                        <p className="text-xs text-slate-450 font-semibold mt-1 max-w-[220px] leading-relaxed">{sys.fullname}</p>
                      </td>

                      {/* Variables */}
                      <td className="py-5 px-4 text-sm font-semibold text-slate-700 leading-relaxed">
                        {sys.variables}
                      </td>

                      {/* Mechanism */}
                      <td className="py-5 px-4">
                        <span className="text-slate-800 font-bold flex items-center gap-1.5">
                          {sys.type === 'API Integrasi' ? (
                            <Server className="h-4 w-4 text-teal-600 shrink-0" />
                          ) : (
                            <FileSpreadsheet className="h-4 w-4 text-amber-600 shrink-0" />
                          )}
                          <span className="text-sm">{sys.type}</span>
                        </span>
                        <span className="text-xs text-slate-450 font-medium block mt-0.5">{sys.method}</span>
                      </td>

                      {/* Schedule */}
                      <td className="py-5 px-4 font-semibold text-slate-700">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                          {sys.schedule}
                        </span>
                      </td>

                      {/* Status & Last Sync */}
                      <td className="py-5 px-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`inline-flex items-center rounded-lg border px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider ${sys.color === 'teal'
                            ? 'bg-emerald-50/50 text-emerald-700 border-emerald-150'
                            : 'bg-amber-50/50 text-amber-700 border-amber-150 animate-pulse'
                            }`}>
                            {sys.status}
                          </span>
                          <span className="text-xs sm:text-sm text-slate-650 block mt-1">{sys.lastSync}</span>
                          <span className="text-xs text-slate-400 italic font-medium block">{sys.recordCount}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-5 px-4 text-center">
                        <button
                          onClick={() => triggerSync(sys.id)}
                          disabled={status === 'syncing' || syncingAll}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-4 py-2.5 text-xs sm:text-sm font-black uppercase tracking-wider transition-all hover:-translate-y-0.5 active:scale-[0.98] ${status === 'success'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-50 border border-slate-200 text-slate-700 hover:bg-teal-50 hover:text-[#047D78] hover:border-teal-200'
                            }`}
                        >
                          <RefreshCw className={`h-3.5 w-3.5 ${status === 'syncing' ? 'animate-spin text-teal-650' : ''}`} />
                          <span>
                            {status === 'idle' && 'Sync'}
                            {status === 'syncing' && 'Syncing'}
                            {status === 'success' && 'Done ✓'}
                          </span>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Sync logs and History */}
        <div className="space-y-4 pt-4">
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-wider">Riwayat Aktivitas Aliran Data</h2>
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse min-w-[700px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-450 font-bold uppercase tracking-wider text-[11.5px] bg-slate-50/50">
                  <th className="py-3 px-4 rounded-l-xl">Tanggal / Waktu</th>
                  <th className="py-3 px-4">Sistem Vertikal</th>
                  <th className="py-3 px-4">Metode Aksi</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4 text-center">Jumlah Data</th>
                  <th className="py-3 px-4 text-center rounded-r-xl">Durasi Proses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {syncLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-4 text-slate-500 font-mono">{log.time}</td>
                    <td className="py-3.5 px-4 text-slate-900">{log.system}</td>
                    <td className="py-3.5 px-4 text-slate-650">{log.action}</td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 border border-emerald-100 px-2 py-0.5 text-xs text-emerald-700 font-extrabold uppercase">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        {log.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-center text-slate-800">{log.records}</td>
                    <td className="py-3.5 px-4 text-center text-slate-500 font-mono">{log.duration}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  )
}
