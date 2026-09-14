'use client'

import React from 'react'
import {
  Settings,
  X,
  Globe,
  Flame,
  Wind,
  Hospital,
  Compass,
  Check,
  MapPin,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react'

export interface TvLayerState {
  baseMap: 'osm' | 'terrain' | 'satellite' | 'light' | 'dark'
  bnpbBanjir: boolean
  bnpbGempa: boolean
  bnpbLongsor: boolean
  bnpbKarhutla: boolean
  bnpbHillshade: boolean
  bnpbKepadatan: boolean
  bnpbAdmin: boolean
  showWindy: boolean
  showFaskes: boolean
  showPosko: boolean
  showTck: boolean
  showChoropleth: boolean
  showMarkers: boolean

  // Faskes Type Sub-Filters (Matching Pengaturan Peta)
  faskesRs: boolean
  faskesPuskesmas: boolean
  faskesKlinik: boolean
  faskesPustu: boolean
  faskesSiagaOnly: boolean

  // Episentrum Impact Radius (km)
  impactRadiusKm: number
}

interface TvLayerServicesDrawerProps {
  isOpen: boolean
  onClose: () => void
  layers: TvLayerState
  onUpdateLayer: (key: keyof TvLayerState, value: any) => void
  onBatchUpdateFaskes?: (allOn: boolean) => void
  onResetLayers: () => void
  faskesCounts?: {
    rs: number
    puskesmas: number
    klinik: number
    pustu: number
    siaga: number
  }
}

const ToggleSwitch = ({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
      checked ? 'bg-[#047D78]' : 'bg-slate-200'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
        checked ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </button>
)

export default function TvLayerServicesDrawer({
  isOpen,
  onClose,
  layers,
  onUpdateLayer,
  onBatchUpdateFaskes,
  onResetLayers,
  faskesCounts = { rs: 64, puskesmas: 430, klinik: 196, pustu: 1121, siaga: 86 },
}: TvLayerServicesDrawerProps) {
  if (!isOpen) return null

  const handleSelectAllFaskes = () => {
    if (onBatchUpdateFaskes) {
      onBatchUpdateFaskes(true)
    } else {
      onUpdateLayer('faskesRs', true)
      onUpdateLayer('faskesPuskesmas', true)
      onUpdateLayer('faskesKlinik', true)
      onUpdateLayer('faskesPustu', true)
    }
  }

  const handleClearAllFaskes = () => {
    if (onBatchUpdateFaskes) {
      onBatchUpdateFaskes(false)
    } else {
      onUpdateLayer('faskesRs', false)
      onUpdateLayer('faskesPuskesmas', false)
      onUpdateLayer('faskesKlinik', false)
      onUpdateLayer('faskesPustu', false)
    }
  }

  return (
    <div className="fixed right-2 sm:right-3 top-[56px] sm:top-[60px] 2xl:top-[64px] bottom-12 z-50 w-80 sm:w-96 max-w-[calc(100vw-20px)] flex flex-col bg-white/95 backdrop-blur-2xl border border-[#bedbda] rounded-xl sm:rounded-2xl shadow-[0_15px_45px_rgba(4,125,120,0.18)] overflow-hidden text-slate-800 animate-in slide-in-from-right-4 duration-300">
      {/* ── Header Pengaturan Peta ── */}
      <div className="p-3 sm:p-3.5 bg-gradient-to-r from-[#047D78] to-[#00B0AA] flex items-center justify-between shadow-md text-white">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-white/15 backdrop-blur-md">
            <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </div>
          <div>
            <h3 className="font-extrabold text-xs sm:text-sm tracking-wider uppercase text-white">
              Pengaturan Peta
            </h3>
            <p className="text-[10px] text-teal-100 font-semibold">
              Fitur Spasial & Kontrol Layer Peta
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="h-7 w-7 rounded-lg bg-black/15 hover:bg-black/30 flex items-center justify-center text-white transition-all cursor-pointer"
          title="Tutup Pengaturan"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Drawer Body ── */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4 text-xs no-scrollbar bg-slate-50/50">
        {/* 1. Toggle Cards Section (Batas Administrasi, Windy, Rute & Faskes) */}
        <div className="space-y-2">
          {/* Batas Administrasi */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#047D78] shrink-0">
                <SlidersHorizontal className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-800 text-xs">Batas Administrasi</span>
                <span className="text-[10px] font-semibold text-slate-500 truncate">
                  Layer GeoJSON kerawanan wilayah
                </span>
              </div>
            </div>
            <ToggleSwitch
              checked={layers.bnpbAdmin}
              onChange={(v) => onUpdateLayer('bnpbAdmin', v)}
            />
          </div>

          {/* Aliran Angin (Windy) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#047D78] shrink-0">
                <Wind className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-800 text-xs">Aliran Angin (Windy)</span>
                <span className="text-[10px] font-semibold text-slate-500 truncate">
                  Tampilkan pola pergerakan angin GFS
                </span>
              </div>
            </div>
            <ToggleSwitch
              checked={layers.showWindy}
              onChange={(v) => onUpdateLayer('showWindy', v)}
            />
          </div>

          {/* Rute Evakuasi & Faskes */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs flex items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0">
              <div className="p-1.5 rounded-xl bg-teal-50 text-[#047D78] shrink-0">
                <Hospital className="h-4 w-4" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="font-bold text-slate-800 text-xs">Rute Evakuasi & Faskes</span>
                <span className="text-[10px] font-semibold text-slate-500 truncate">
                  Tampilkan jalur rute jalan raya dan pin faskes
                </span>
              </div>
            </div>
            <ToggleSwitch
              checked={layers.showFaskes}
              onChange={(v) => onUpdateLayer('showFaskes', v)}
            />
          </div>
        </div>

        {/* 2. TIPE FASILITAS KESEHATAN Section */}
        {layers.showFaskes && (
          <div className="space-y-2 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <span className="font-black text-[11px] uppercase tracking-wider text-slate-700">
                Tipe Fasilitas Kesehatan
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSelectAllFaskes}
                  className="px-2.5 py-0.5 rounded-md bg-teal-50 border border-teal-300 text-[10px] font-bold text-[#047D78] hover:bg-teal-100 transition-all cursor-pointer"
                >
                  Semua
                </button>
                <button
                  type="button"
                  onClick={handleClearAllFaskes}
                  className="px-2.5 py-0.5 rounded-md bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-600 hover:bg-slate-200 transition-all cursor-pointer"
                >
                  Hapus
                </button>
              </div>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
              {/* Rumah Sakit (RS) */}
              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={layers.faskesRs}
                    onChange={(e) => onUpdateLayer('faskesRs', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#047D78] focus:ring-[#047D78] cursor-pointer"
                  />
                  <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/rs.svg`} alt="RS" className="w-4 h-4 shrink-0" />
                  <span className="font-bold text-slate-800 text-xs">Rumah Sakit (RS)</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {faskesCounts.rs.toLocaleString('id-ID')}
                </span>
              </label>

              {/* Puskesmas */}
              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={layers.faskesPuskesmas}
                    onChange={(e) => onUpdateLayer('faskesPuskesmas', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#047D78] focus:ring-[#047D78] cursor-pointer"
                  />
                  <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/puskes.svg`} alt="Puskesmas" className="w-4 h-4 shrink-0" />
                  <span className="font-bold text-slate-800 text-xs">Puskesmas</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {faskesCounts.puskesmas.toLocaleString('id-ID')}
                </span>
              </label>

              {/* Klinik */}
              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={layers.faskesKlinik}
                    onChange={(e) => onUpdateLayer('faskesKlinik', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#047D78] focus:ring-[#047D78] cursor-pointer"
                  />
                  <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/klinik.svg`} alt="Klinik" className="w-4 h-4 shrink-0" />
                  <span className="font-bold text-slate-800 text-xs">Klinik</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {faskesCounts.klinik.toLocaleString('id-ID')}
                </span>
              </label>

              {/* Puskesmas Pembantu (Pustu) */}
              <label className="flex items-center justify-between p-1 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={layers.faskesPustu}
                    onChange={(e) => onUpdateLayer('faskesPustu', e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[#047D78] focus:ring-[#047D78] cursor-pointer"
                  />
                  <img src={`${process.env.NEXT_PUBLIC_BASE_PATH || ''}/pustu.svg`} alt="Pustu" className="w-4 h-4 shrink-0" />
                  <span className="font-bold text-slate-800 text-xs">Puskesmas Pembantu (Pustu)</span>
                </div>
                <span className="font-mono text-xs font-bold text-slate-500">
                  {faskesCounts.pustu.toLocaleString('id-ID')}
                </span>
              </label>

              <div className="border-t border-slate-100 pt-2">
                {/* Hanya Faskes Rawat Pasien */}
                <label className="flex items-center justify-between p-1 rounded-lg hover:bg-amber-50/50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={layers.faskesSiagaOnly}
                      onChange={(e) => onUpdateLayer('faskesSiagaOnly', e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                    />
                    <span className="font-bold text-slate-800 text-xs">Hanya Faskes Rawat Pasien</span>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-500">
                    {faskesCounts.siaga.toLocaleString('id-ID')}
                  </span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* 3. RADIUS EPISENTRUM & DAMPAK Section */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs space-y-2">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-red-600" />
            <div className="flex flex-col">
              <span className="font-bold text-slate-800 text-xs">Radius Episentrum & Dampak</span>
              <span className="text-[10px] font-semibold text-slate-500">Jangkauan area dampak (km)</span>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { km: 0, label: 'Off (0 km)' },
              { km: 1, label: '1 km' },
              { km: 5, label: '5 km' },
              { km: 10, label: '10 km' },
              { km: 25, label: '25 km' },
              { km: 50, label: '50 km' },
              { km: -1, label: 'Semua Ring' },
            ].map((r) => (
              <button
                key={r.km}
                type="button"
                onClick={() => onUpdateLayer('impactRadiusKm', r.km)}
                className={`py-1.5 px-1 text-center rounded-xl text-[10px] font-black transition-all cursor-pointer border ${
                  layers.impactRadiusKm === r.km
                    ? 'bg-rose-500 text-white border-rose-500 shadow-md shadow-rose-500/25 scale-[1.02]'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Basemap Selector */}
        <div>
          <h4 className="font-extrabold text-orange-700 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5 text-orange-600" />
            Peta Dasar (Basemap)
          </h4>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'osm', label: 'OpenStreetMap (Road)' },
              { id: 'terrain', label: 'Topografi / Terrain' },
              { id: 'satellite', label: 'Citra Satelit' },
              { id: 'light', label: 'Positron Light' },
            ].map((bm) => (
              <button
                key={bm.id}
                type="button"
                onClick={() => onUpdateLayer('baseMap', bm.id as any)}
                className={`flex items-center justify-between p-2 rounded-xl border text-left transition-all cursor-pointer ${
                  layers.baseMap === bm.id
                    ? 'bg-orange-50 border-orange-400 text-orange-800 font-extrabold shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                }`}
              >
                <span className="text-xs">{bm.label}</span>
                {layers.baseMap === bm.id && <Check className="h-3.5 w-3.5 text-orange-600" />}
              </button>
            ))}
          </div>
        </div>

        {/* 5. Hazard Overlays (BNPB) */}
        <div>
          <h4 className="font-extrabold text-orange-700 uppercase tracking-wider text-[11px] mb-2 flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-orange-600" />
            Lapisan Bahaya Kebencanaan (BNPB)
          </h4>
          <div className="space-y-1 bg-white p-2.5 rounded-2xl border border-slate-200 shadow-2xs">
            {[
              { key: 'bnpbBanjir', label: 'Bahaya Banjir' },
              { key: 'bnpbGempa', label: 'Bahaya Gempa Bumi' },
              { key: 'bnpbLongsor', label: 'Bahaya Tanah Longsor' },
              { key: 'bnpbKarhutla', label: 'Bahaya Kebakaran Hutan & Lahan' },
              { key: 'bnpbHillshade', label: 'Indo Hillshade (Ketinggian)' },
              { key: 'bnpbKepadatan', label: 'Kepadatan Penduduk 2020' },
            ].map((item) => {
              const isChecked = Boolean(layers[item.key as keyof TvLayerState])
              return (
                <label
                  key={item.key}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-orange-50/50 cursor-pointer transition-colors"
                >
                  <span className="text-slate-700 font-semibold">{item.label}</span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => onUpdateLayer(item.key as keyof TvLayerState, e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
                  />
                </label>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Drawer Footer ── */}
      <div className="p-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onResetLayers}
          className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-all border border-slate-200 cursor-pointer"
        >
          Reset Default
        </button>

        <button
          type="button"
          onClick={onClose}
          className="flex-1 py-2 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-xs transition-all shadow-md shadow-orange-600/20 cursor-pointer"
        >
          Terapkan Pengaturan
        </button>
      </div>
    </div>
  )
}
