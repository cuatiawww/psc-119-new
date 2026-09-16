import { create } from 'zustand'

export interface User {
  id_user: number
  username: string
  email: string
  nama_lengkap: string
  no_telpon?: string
  level_user_id: number
  level_name?: string
  kode_psc?: string
  id_reg_psc?: string
  dmt_provinsi?: string
  dmt_kabupaten?: string
  kepemilikan_psc?: string
  wilayah_scope?: WilayahScope
}

export type WilayahScopeMode = 'all' | 'provinsi' | 'kabupaten'

export interface WilayahScopeOption {
  id?: string | number | null
  value?: string
  label: string
  locked: boolean
  options?: Array<{
    id: string | number
    label: string
  }>
}

export interface WilayahScope {
  mode: WilayahScopeMode
  access_label: string
  cakupan: WilayahScopeOption
  provinsi: WilayahScopeOption
  kabupaten: WilayahScopeOption
}

export interface PscCenterPayload {
  id?: number | string
  kode_psc?: string
  nama_psc?: string
  provinsi?: string
  kabupaten?: string
  kd_prop?: string | number
  kd_kab?: string | number
  [key: string]: unknown
}

interface AuthState {
  token: string | null
  user: User | null
  isAuthenticated: boolean
  isGuest: boolean
  isInitialized: boolean
  login: (token: string, user: User) => void
  loginAsGuest: () => void
  loginAsPscUnit: (kodePsc: string, centerData?: PscCenterPayload | null) => void
  logout: () => void
  initialize: () => void
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  isAuthenticated: false,
  isGuest: false,
  isInitialized: false,
  login: (token, user) => {
    localStorage.setItem('auth_token', token)
    localStorage.setItem('auth_user', JSON.stringify(user))
    localStorage.removeItem('auth_guest')
    // Pertahankan konteks unit PSC dari SSO saat berpindah halaman.
    // Sebelumnya nilai ini dihapus setiap kali login sehingga dashboard
    // kembali meminta data nasional setelah membuka halaman detail.
    const kodePsc = String(user.kode_psc || '').trim().toUpperCase()
    if (kodePsc) {
      localStorage.setItem('auth_kode_psc', kodePsc)
    } else {
      // Admin tidak memiliki scope PSC tetap. Bersihkan sisa konteks PSC
      // dari sesi sebelumnya agar dashboard kembali ke cakupan nasional.
      localStorage.removeItem('auth_kode_psc')
    }
    set({ token, user, isAuthenticated: true, isGuest: false })
  },
  loginAsGuest: () => {
    localStorage.setItem('auth_guest', 'true')
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_kode_psc')
    set({ token: null, user: null, isAuthenticated: false, isGuest: true })
  },
  loginAsPscUnit: (kodePsc, centerData) => {
    const cleanKode = kodePsc.trim().toUpperCase()
    const provName = (centerData?.provinsi || '').trim()
    const kabName = (centerData?.kabupaten || '').trim()
    const namaPsc = centerData?.nama_psc || `PSC 119 ${cleanKode}`

    const rawId = Number(centerData?.id)
    const unitUser: User = {
      id_user: Number.isFinite(rawId) && rawId > 0 ? rawId : 9287,
      username: cleanKode,
      email: `${cleanKode.toLowerCase()}@psc119.kemkes.go.id`,
      nama_lengkap: namaPsc,
      level_user_id: 2,
      level_name: 'Unit PSC 119',
      wilayah_scope: (provName || kabName) ? {
        mode: 'kabupaten',
        access_label: `${namaPsc} (${kabName || 'Wilayah'}, ${provName || 'Indonesia'})`,
        cakupan: {
          id: 'kabupaten-kota',
          value: 'kabupaten-kota',
          label: 'KABUPATEN/KOTA',
          locked: true,
        },
        provinsi: {
          id: centerData?.kd_prop || '',
          value: provName.toLowerCase(),
          label: provName,
          locked: true,
          options: [{ id: centerData?.kd_prop || '', label: provName }],
        },
        kabupaten: {
          id: centerData?.kd_kab || '',
          value: kabName.toLowerCase(),
          label: kabName,
          locked: true,
          options: [{ id: centerData?.kd_kab || '', label: kabName }],
        },
      } : {
        mode: 'kabupaten',
        access_label: namaPsc,
        cakupan: {
          id: 'kabupaten-kota',
          value: 'kabupaten-kota',
          label: 'KABUPATEN/KOTA',
          locked: true,
        },
        provinsi: {
          label: '',
          locked: true,
        },
        kabupaten: {
          label: '',
          locked: true,
        },
      },
    }

    const unitToken = `psc-unit-${cleanKode}`
    localStorage.setItem('auth_token', unitToken)
    localStorage.setItem('auth_user', JSON.stringify(unitUser))
    localStorage.setItem('auth_kode_psc', cleanKode)
    localStorage.removeItem('auth_guest')

    set({
      token: unitToken,
      user: unitUser,
      isAuthenticated: true,
      isGuest: false,
      isInitialized: true,
    })
  },
  logout: () => {
    // Ambil token sebelum dihapus untuk dikirim ke backend
    const currentToken = localStorage.getItem('auth_token')

    // Hapus state lokal segera (UX tetap responsif)
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
    localStorage.removeItem('auth_guest')
    localStorage.removeItem('auth_kode_psc')
    localStorage.setItem('auth_guest', 'true')
    set({ token: null, user: null, isAuthenticated: false, isGuest: true })

    // Single Sign-Out: hit backend Yii2 agar session server juga terhapus jika bukan token lokal psc-unit
    if (currentToken && !currentToken.startsWith('psc-unit-')) {
      const backendBase = process.env.NEXT_PUBLIC_SIPKK_BACKEND_BASE_URL || 'https://sipkk-new.mediaciptainformasi.co.id'
      fetch(`${backendBase}/api/logout`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${currentToken}`,
          'Content-Type': 'application/json',
        },
        // fire-and-forget — jangan await, biarkan berjalan di background
        keepalive: true,
      }).catch(() => {
        // Abaikan error jaringan — logout lokal sudah berhasil
      })
    }

    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      if (url.searchParams.has('kode_psc')) {
        url.searchParams.delete('kode_psc')
        window.location.href = url.pathname + (url.search ? url.search : '')
      }
    }
  },
  initialize: () => {
    if (typeof window === 'undefined') return
    const token = localStorage.getItem('auth_token')
    const userStr = localStorage.getItem('auth_user')
    const isGuestStr = localStorage.getItem('auth_guest')

    if (token && userStr) {
      try {
        const user = JSON.parse(userStr)
        // kode_psc pada URL hanya boleh menjadi filter setelah sesi valid.
        // URL tersebut tidak boleh membuat sesi PSC baru.
        const userKodePsc = String(user?.kode_psc || '').trim().toUpperCase()
        if (userKodePsc) localStorage.setItem('auth_kode_psc', userKodePsc)
        set({ token, user, isAuthenticated: true, isGuest: false, isInitialized: true })
      } catch {
        localStorage.removeItem('auth_token')
        localStorage.removeItem('auth_user')
        localStorage.removeItem('auth_kode_psc')
        set({ token: null, user: null, isAuthenticated: false, isGuest: true, isInitialized: true })
      }
    } else if (isGuestStr === 'true') {
      set({ token: null, user: null, isAuthenticated: false, isGuest: true, isInitialized: true })
    } else {
      localStorage.setItem('auth_guest', 'true')
      set({ token: null, user: null, isAuthenticated: false, isGuest: true, isInitialized: true })
    }
  }
}))
