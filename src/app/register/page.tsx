'use client'

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2, UserPlus, ArrowLeft, Building2, Briefcase, MapPin, Phone, Mail, UserRound, LockKeyhole, KeyRound, Check, X, RefreshCw } from 'lucide-react'
import { buildApiUrl, buildRegionsUrl } from '@/lib/utils/api'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

type Region = {
  id: string
  code?: string
  name: string
}

type RegisterResponse = {
  success?: boolean
  registration_id?: number
  message?: string
  errors?: Record<string, string>
}

export default function RegisterPage() {
  const baseApiUrl = useMemo(() => buildApiUrl('/api'), [])

  // Flow State: 'form' | 'otp' | 'success'
  const [step, setStep] = useState<'form' | 'otp' | 'success'>('form')
  const [registrationId, setRegistrationId] = useState<number | null>(null)

  // Form states
  const [namaLengkap, setNamaLengkap] = useState('')
  const [captchaKey, setCaptchaKey] = useState('')
  const [captchaQuestion, setCaptchaQuestion] = useState('')
  const [captchaImage, setCaptchaImage] = useState('')
  const [captchaValue, setCaptchaValue] = useState('')
  const [loadingCaptcha, setLoadingCaptcha] = useState(false)
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [showTermsModal, setShowTermsModal] = useState(false)

  const fetchCaptcha = useCallback(async () => {
    setLoadingCaptcha(true)
    try {
      const res = await fetch(`${baseApiUrl}/captcha`)
      const payload = await res.json()
      if (payload?.success) {
        setCaptchaKey(payload.captcha_key)
        setCaptchaImage(payload.captcha_image || '')
        setCaptchaQuestion(payload.captcha_question || '')
        setCaptchaValue('')
      }
    } catch (err) {
      console.error('Gagal mengambil captcha', err)
    } finally {
      setLoadingCaptcha(false)
    }
  }, [baseApiUrl])
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [telp, setTelp] = useState('')
  const [kategoriAkses, setKategoriAkses] = useState('masyarakat_umum')
  const [alamatUser, setAlamatUser] = useState('')
  const [provinsiId, setProvinsiId] = useState('')
  const [kabupatenId, setKabupatenId] = useState('')
  const [kecamatanId, setKecamatanId] = useState('')
  const [desaId, setDesaId] = useState('')
  const [tujuanAkses, setTujuanAkses] = useState('riset_analisa')
  const [tujuanAksesLainnya, setTujuanAksesLainnya] = useState('')
  const [namaInstitusi, setNamaInstitusi] = useState('')
  const [pekerjaanPosisi, setPekerjaanPosisi] = useState('')
  const [password, setPassword] = useState('')
  const [rePassword, setRePassword] = useState('')

  // OTP State
  const [otpCode, setOtpCode] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  // UI States
  const [provinces, setProvinces] = useState<Region[]>([])
  const [regencies, setRegencies] = useState<Region[]>([])
  const [districts, setDistricts] = useState<Region[]>([])
  const [villages, setVillages] = useState<Region[]>([])
  const [loadingProvinces, setLoadingProvinces] = useState(false)
  const [loadingRegencies, setLoadingRegencies] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [loadingVillages, setLoadingVillages] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [verifyingOtp, setVerifyingOtp] = useState(false)
  const [resendingOtp, setResendingOtp] = useState(false)

  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [successMessage, setSuccessMessage] = useState('')

  // Realtime password checks
  const pwdChecks = useMemo(() => {
    return {
      minLength: password.length >= 8,
      hasUpper: /[A-Z]/.test(password),
      hasLower: /[a-z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[@$!%*?&]/.test(password),
    }
  }, [password])

  const isPasswordValid =
    pwdChecks.minLength &&
    pwdChecks.hasUpper &&
    pwdChecks.hasLower &&
    pwdChecks.hasNumber &&
    pwdChecks.hasSpecial

  // Strength score: 0 to 5 based on checklist
  const strengthScore = useMemo(() => {
    if (!password) return 0
    let score = 0
    if (pwdChecks.minLength) score++
    if (pwdChecks.hasUpper) score++
    if (pwdChecks.hasLower) score++
    if (pwdChecks.hasNumber) score++
    if (pwdChecks.hasSpecial) score++
    return score
  }, [password, pwdChecks])

  // Fetch provinces on mount
  useEffect(() => {
    async function fetchProvinces() {
      setLoadingProvinces(true)
      try {
        const res = await fetch(buildRegionsUrl())
        const payload = await res.json()
        if (payload?.success && Array.isArray(payload?.data)) {
          setProvinces(payload.data)
        }
      } catch (err) {
        console.error('Failed to load provinces', err)
      } finally {
        setLoadingProvinces(false)
      }
    }
    fetchProvinces()
  }, [baseApiUrl])

  useEffect(() => {
    fetchCaptcha()
  }, [fetchCaptcha])

  // Fetch regencies when province changes
  useEffect(() => {
    setKabupatenId('')
    setKecamatanId('')
    setDesaId('')
    setRegencies([])
    setDistricts([])
    setVillages([])
    if (!provinsiId) return

    async function fetchRegencies() {
      setLoadingRegencies(true)
      try {
        const res = await fetch(buildRegionsUrl({ province_id: provinsiId }))
        const payload = await res.json()
        if (payload?.success && Array.isArray(payload?.data)) {
          setRegencies(payload.data)
        }
      } catch (err) {
        console.error('Failed to load regencies', err)
      } finally {
        setLoadingRegencies(false)
      }
    }
    fetchRegencies()
  }, [provinsiId, baseApiUrl])

  // Fetch districts when regency changes
  useEffect(() => {
    setKecamatanId('')
    setDesaId('')
    setDistricts([])
    setVillages([])
    if (!kabupatenId) return

    async function fetchDistricts() {
      setLoadingDistricts(true)
      try {
        const res = await fetch(buildRegionsUrl({ kabupaten_id: kabupatenId }))
        const payload = await res.json()
        if (payload?.success && Array.isArray(payload?.data)) {
          setDistricts(payload.data)
        }
      } catch (err) {
        console.error('Failed to load districts', err)
      } finally {
        setLoadingDistricts(false)
      }
    }
    fetchDistricts()
  }, [kabupatenId, baseApiUrl])

  // Fetch villages when district changes
  useEffect(() => {
    setDesaId('')
    setVillages([])
    if (!kecamatanId) return

    async function fetchVillages() {
      setLoadingVillages(true)
      try {
        const res = await fetch(buildRegionsUrl({ kecamatan_id: kecamatanId }))
        const payload = await res.json()
        if (payload?.success && Array.isArray(payload?.data)) {
          setVillages(payload.data)
        }
      } catch (err) {
        console.error('Failed to load villages', err)
      } finally {
        setLoadingVillages(false)
      }
    }
    fetchVillages()
  }, [kecamatanId, baseApiUrl])

  // Countdown timer for Resend OTP
  useEffect(() => {
    if (resendCooldown <= 0) return
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [resendCooldown])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    // Frontend Validations
    if (!isPasswordValid) {
      setError('Password belum memenuhi seluruh kriteria keamanan.')
      return
    }

    if (password !== rePassword) {
      setFieldErrors({ re_password: 'Konfirmasi password tidak cocok.' })
      return
    }

    if (!captchaValue) {
      setError('Captcha wajib diisi.')
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${baseApiUrl}/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          kategori_akses: kategoriAkses,
          nama_lengkap: namaLengkap,
          username,
          password,
          re_password: rePassword,
          email,
          telp,
          nama_institusi: namaInstitusi,
          pekerjaan_posisi: pekerjaanPosisi,
          alamat_user: alamatUser,
          provinsi_id: provinsiId,
          kabupaten_id: kabupatenId,
          kecamatan_id: kecamatanId,
          desa_id: desaId,
          tujuan_akses: tujuanAkses,
          tujuan_akses_lainnya: tujuanAksesLainnya,
          captcha_key: captchaKey,
          captcha_value: captchaValue.trim(),
        }),
      })

      const payload = (await response.json().catch(() => null)) as RegisterResponse | null

      if (!response.ok || !payload?.success || !payload.registration_id) {
        fetchCaptcha()
        if (payload?.errors) {
          setFieldErrors(payload.errors)
        }
        throw new Error(payload?.message || 'Registrasi gagal. Cek kembali form Anda.')
      }

      setRegistrationId(payload.registration_id)
      setStep('otp')
      setResendCooldown(60) // Cooldown 60s
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Verify OTP
  const handleVerifyOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')

    if (otpCode.length !== 4 || isNaN(Number(otpCode))) {
      setError('Kode OTP harus berupa 4 digit angka.')
      return
    }

    setVerifyingOtp(true)
    try {
      const res = await fetch(`${baseApiUrl}/verify-register-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          registration_id: registrationId,
          otp: otpCode.trim()
        })
      })

      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Verifikasi OTP gagal.')
      }

      setSuccessMessage(payload.message || 'Verifikasi email berhasil!')
      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verifikasi gagal. Silakan coba lagi.')
    } finally {
      setVerifyingOtp(false)
    }
  }

  // Handle Resend OTP
  const handleResendOtp = async () => {
    if (resendCooldown > 0) return
    setError('')
    setResendingOtp(true)

    try {
      const res = await fetch(`${baseApiUrl}/resend-register-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          registration_id: registrationId
        })
      })

      const payload = await res.json()
      if (!res.ok || !payload?.success) {
        throw new Error(payload?.message || 'Gagal mengirim ulang OTP.')
      }

      setResendCooldown(60)
      alert(payload.message || 'Kode OTP baru telah dikirim ke email Anda.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim ulang OTP.')
    } finally {
      setResendingOtp(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
      {/* Background image */}
      <Image
        src={`${basePath}/BACKGROUND-SIPKK NEW.png`}
        alt="Background"
        fill
        priority
        sizes="100vw"
        className="object-cover object-center z-0"
      />

      {/* Overlay gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-950/85 via-teal-900/70 to-[#0e6b65]/60 z-0" />

      {/* Subtle grid texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.05] z-0"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px),repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(255,255,255,1) 39px,rgba(255,255,255,1) 40px)',
        }}
      />

      <div className="relative z-10 w-full max-w-[800px] bg-white rounded-3xl border border-[#c8dedd] shadow-[0_25px_70px_rgba(0,0,0,0.25)] p-6 sm:p-10">

        {/* Back Link (Visible only on Form or Success Step) */}
        {step !== 'otp' && (
          <Link href="/login" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-semibold text-sm mb-6 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Kembali ke Halaman Masuk
          </Link>
        )}

        {/* Form Step */}
        {step === 'form' && (
          <div>
            {/* Header */}
            <div className="mb-8">
              <h2 className="mt-3 text-[32px] font-extrabold leading-tight tracking-tight text-slate-900">
                Daftar sebagai Masyarakat
              </h2>
              <p className="mt-1 text-slate-500 text-sm">
                Lengkapi data diri Anda untuk pengajuan akun Dashboard Faskes.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                  <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Nama Lengkap */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Nama Lengkap</label>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-500 focus-within:bg-white">
                    <UserRound className="h-[18px] w-[18px] text-slate-450" />
                    <input
                      value={namaLengkap}
                      onChange={(e) => setNamaLengkap(e.target.value)}
                      required
                      placeholder="Nama lengkap sesuai KTP"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.nama_lengkap && <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.nama_lengkap}</p>}
                </div>

                {/* Username */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Username</label>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-500 focus-within:bg-white">
                    <UserRound className="h-[18px] w-[18px] text-slate-450" />
                    <input
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      placeholder="Username minimal 4 karakter"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.username && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.username}</p>}
                </div>

                {/* Email */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Alamat Email</label>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-500 focus-within:bg-white">
                    <Mail className="h-[18px] w-[18px] text-slate-450" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="contoh@domain.com"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.email && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.email}</p>}
                </div>

                {/* Telp */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">No. Telepon / WA</label>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-500 focus-within:bg-white">
                    <Phone className="h-[18px] w-[18px] text-slate-450" />
                    <input
                      value={telp}
                      onChange={(e) => setTelp(e.target.value)}
                      required
                      placeholder="Contoh: 08123456789"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.telp && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.telp}</p>}
                </div>

                {/* Kategori Akses */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Kategori Akses</label>
                  <select
                    value={kategoriAkses}
                    onChange={(e) => setKategoriAkses(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white"
                  >
                    <option value="masyarakat_umum">Masyarakat Umum</option>
                    <option value="lintas_sektor">Lintas Sektor</option>
                    <option value="ngo_ormas">NGO / Ormas</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                  {fieldErrors.kategori_akses && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.kategori_akses}</p>}
                </div>

                {/* Tujuan Akses */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Tujuan Akses Data</label>
                  <select
                    value={tujuanAkses}
                    onChange={(e) => setTujuanAkses(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white"
                  >
                    <option value="riset_analisa">Riset / Analisa</option>
                    <option value="referensi_media">Sumber Referensi / Media</option>
                    <option value="integrasi_interoperabilitas">Integrasi / Interoperabilitas</option>
                    <option value="lainnya">Lainnya</option>
                  </select>
                  {fieldErrors.tujuan_akses && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.tujuan_akses}</p>}
                </div>
              </div>

              {/* Conditional: Tujuan Akses Lainnya */}
              {tujuanAkses === 'lainnya' && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Tulis Tujuan Akses Lainnya</label>
                  <textarea
                    value={tujuanAksesLainnya}
                    onChange={(e) => setTujuanAksesLainnya(e.target.value)}
                    required
                    placeholder="Sebutkan tujuan detail pengaksesan data"
                    rows={2}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white"
                  />
                  {fieldErrors.tujuan_akses_lainnya && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.tujuan_akses_lainnya}</p>}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Nama Institusi */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Nama Institusi (Opsional)</label>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-500 focus-within:bg-white">
                    <Building2 className="h-[18px] w-[18px] text-slate-450" />
                    <input
                      value={namaInstitusi}
                      onChange={(e) => setNamaInstitusi(e.target.value)}
                      placeholder="Nama Universitas / Instansi"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.nama_institusi && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.nama_institusi}</p>}
                </div>

                {/* Pekerjaan / Posisi */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Pekerjaan / Jabatan (Opsional)</label>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-500 focus-within:bg-white">
                    <Briefcase className="h-[18px] w-[18px] text-slate-450" />
                    <input
                      value={pekerjaanPosisi}
                      onChange={(e) => setPekerjaanPosisi(e.target.value)}
                      placeholder="Dosen / Mahasiswa / Staff"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {fieldErrors.pekerjaan_posisi && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.pekerjaan_posisi}</p>}
                </div>

                {/* Provinsi */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Provinsi {loadingProvinces && <span className="text-teal-600 animate-pulse">(Memuat...)</span>}
                  </label>
                  <select
                    value={provinsiId}
                    onChange={(e) => setProvinsiId(e.target.value)}
                    required
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white"
                  >
                    <option value="">Pilih Provinsi</option>
                    {provinces.map((prov) => (
                      <option key={prov.id} value={prov.id}>
                        {prov.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.provinsi_id && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.provinsi_id}</p>}
                </div>

                {/* Kabupaten / Kota */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Kabupaten / Kota {loadingRegencies && <span className="text-teal-600 animate-pulse">(Memuat...)</span>}
                  </label>
                  <select
                    value={kabupatenId}
                    onChange={(e) => setKabupatenId(e.target.value)}
                    required
                    disabled={!provinsiId}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white disabled:opacity-50"
                  >
                    <option value="">{provinsiId ? 'Pilih Kabupaten / Kota' : 'Pilih Provinsi dahulu'}</option>
                    {regencies.map((reg) => (
                      <option key={reg.id} value={reg.id}>
                        {reg.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.kabupaten_id && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.kabupaten_id}</p>}
                </div>

                {/* Kecamatan */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Kecamatan {loadingDistricts && <span className="text-teal-600 animate-pulse">(Memuat...)</span>}
                  </label>
                  <select
                    value={kecamatanId}
                    onChange={(e) => setKecamatanId(e.target.value)}
                    required
                    disabled={!kabupatenId}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white disabled:opacity-50"
                  >
                    <option value="">{kabupatenId ? 'Pilih Kecamatan' : 'Pilih Kabupaten / Kota dahulu'}</option>
                    {districts.map((district) => (
                      <option key={district.id} value={district.id}>
                        {district.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.kecamatan_id && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.kecamatan_id}</p>}
                </div>

                {/* Desa / Kelurahan */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">
                    Desa / Kelurahan {loadingVillages && <span className="text-teal-600 animate-pulse">(Memuat...)</span>}
                  </label>
                  <select
                    value={desaId}
                    onChange={(e) => setDesaId(e.target.value)}
                    required
                    disabled={!kecamatanId}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition-all focus:border-teal-500 focus:bg-white disabled:opacity-50"
                  >
                    <option value="">{kecamatanId ? 'Pilih Desa / Kelurahan' : 'Pilih Kecamatan dahulu'}</option>
                    {villages.map((village) => (
                      <option key={village.id} value={village.id}>
                        {village.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.desa_id && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.desa_id}</p>}
                </div>
              </div>

              {/* Alamat User */}
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-700">Alamat Rumah Lengkap</label>
                <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-all focus-within:border-teal-500 focus-within:bg-white">
                  <MapPin className="h-[18px] w-[18px] text-slate-450 mt-1" />
                  <textarea
                    value={alamatUser}
                    onChange={(e) => setAlamatUser(e.target.value)}
                    required
                    placeholder="Nama jalan, nomor rumah, RT/RW, kelurahan, kecamatan"
                    rows={3}
                    className="min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none resize-none"
                  />
                </div>
                {fieldErrors.alamat_user && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.alamat_user}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Password */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Password</label>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-500 focus-within:bg-white">
                    <LockKeyhole className="h-[18px] w-[18px] text-slate-450" />
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="Minimal 8 karakter"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {/* Realtime Checklist */}
                  {password.length > 0 && (
                    <div className="mt-2.5 space-y-2.5 rounded-xl border border-slate-100 bg-slate-50/50 p-3">
                      {/* Strength Bar */}
                      <div>
                        <div className="flex justify-between items-center mb-1 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                          <span>Kekuatan Sandi:</span>
                          <span className={
                            strengthScore === 1 ? 'text-red-500 font-extrabold' :
                              strengthScore === 2 ? 'text-orange-500 font-extrabold' :
                                strengthScore === 3 ? 'text-yellow-600 font-extrabold' :
                                  strengthScore === 4 ? 'text-blue-600 font-extrabold' :
                                    strengthScore === 5 ? 'text-emerald-600 font-extrabold' : 'text-slate-400'
                          }>
                            {strengthScore === 1 && 'Sangat Lemah'}
                            {strengthScore === 2 && 'Lemah'}
                            {strengthScore === 3 && 'Cukup Kuat'}
                            {strengthScore === 4 && 'Kuat'}
                            {strengthScore === 5 && 'Sangat Kuat'}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${strengthScore === 1 ? 'bg-red-500 w-1/5' :
                              strengthScore === 2 ? 'bg-orange-500 w-2/5' :
                                strengthScore === 3 ? 'bg-yellow-500 w-3/5' :
                                  strengthScore === 4 ? 'bg-blue-500 w-4/5' :
                                    strengthScore === 5 ? 'bg-emerald-500 w-full' : 'w-0'
                              }`}
                          />
                        </div>
                      </div>

                      <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Kriteria Keamanan Sandi:</p>
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs">
                        <div className="flex items-center gap-1.5">
                          {pwdChecks.minLength ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                          <span className={pwdChecks.minLength ? 'text-teal-700 font-medium' : 'text-slate-500'}>Min. 8 karakter</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {pwdChecks.hasUpper ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                          <span className={pwdChecks.hasUpper ? 'text-teal-700 font-medium' : 'text-slate-500'}>Huruf Besar (A-Z)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {pwdChecks.hasLower ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                          <span className={pwdChecks.hasLower ? 'text-teal-700 font-medium' : 'text-slate-500'}>Huruf Kecil (a-z)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {pwdChecks.hasNumber ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                          <span className={pwdChecks.hasNumber ? 'text-teal-700 font-medium' : 'text-slate-500'}>Angka (0-9)</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          {pwdChecks.hasSpecial ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                          <span className={pwdChecks.hasSpecial ? 'text-teal-700 font-medium' : 'text-slate-500'}>Karakter Khusus (@$!%*?&)</span>
                        </div>
                      </div>
                    </div>
                  )}
                  {fieldErrors.password && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.password}</p>}
                </div>

                {/* Confirm Password */}
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-slate-700">Konfirmasi Password</label>
                  <div className="flex h-11 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 transition-all focus-within:border-teal-500 focus-within:bg-white">
                    <LockKeyhole className="h-[18px] w-[18px] text-slate-450" />
                    <input
                      type="password"
                      value={rePassword}
                      onChange={(e) => setRePassword(e.target.value)}
                      required
                      placeholder="Ulangi password"
                      className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                    />
                  </div>
                  {/* Password Match Check */}
                  {rePassword.length > 0 && (
                    <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                      {password === rePassword ? (
                        <span className="flex items-center gap-1.5 text-teal-700 font-medium">
                          <Check className="h-3.5 w-3.5 text-teal-600" /> Password cocok
                        </span>
                      ) : (
                        <span className="flex items-center gap-1.5 text-red-600 font-medium">
                          <X className="h-3.5 w-3.5 text-red-500" /> Password tidak cocok
                        </span>
                      )}
                    </div>
                  )}
                  {fieldErrors.re_password && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.re_password}</p>}
                </div>
              </div>

              {/* Captcha */}
              <div className="space-y-2 max-w-[320px]">
                <label className="block text-xs font-bold text-slate-700">
                  Keamanan (Captcha)
                </label>
                <div className="flex items-center gap-2.5">
                  <div className="flex h-11 flex-1 items-center justify-between rounded-xl border border-slate-200 bg-teal-50/50 px-3 font-bold text-slate-700 shadow-inner overflow-hidden">
                    {loadingCaptcha ? (
                      <span className="text-xs font-normal text-slate-400 animate-pulse">Memuat...</span>
                    ) : captchaImage ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={captchaImage}
                        alt="Captcha"
                        className="h-8 w-[110px] rounded object-cover select-none pointer-events-none"
                      />
                    ) : (
                      <span className="text-sm tracking-wide text-teal-800 font-extrabold">{captchaQuestion}</span>
                    )}
                    <button
                      type="button"
                      onClick={fetchCaptcha}
                      disabled={submitting || loadingCaptcha}
                      className="rounded-lg p-1.5 text-slate-450 hover:bg-teal-50 hover:text-teal-700 transition"
                      title="Segarkan Captcha"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingCaptcha ? 'animate-spin' : ''}`} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={captchaValue}
                    onChange={(e) => setCaptchaValue(e.target.value)}
                    required
                    placeholder="Jawaban"
                    disabled={submitting}
                    className="h-11 w-28 rounded-xl border border-slate-200 bg-slate-50 px-3 text-center text-sm font-extrabold text-slate-900 outline-none transition duration-150 placeholder:font-normal placeholder:text-slate-400 focus:border-teal-500 focus:bg-white"
                  />
                </div>
              </div>

              {/* Syarat & Ketentuan Checkbox */}
              <div className="flex items-start gap-3 pt-2">
                <input
                  type="checkbox"
                  id="acceptTerms"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-teal-700 focus:ring-teal-500 cursor-pointer"
                  disabled={submitting}
                />
                <label htmlFor="acceptTerms" className="text-xs font-semibold text-slate-650 leading-normal cursor-pointer select-none">
                  Saya menyetujui seluruh{' '}
                  <button
                    type="button"
                    onClick={() => setShowTermsModal(true)}
                    className="text-teal-600 hover:text-teal-700 hover:underline font-bold"
                  >
                    Syarat & Ketentuan
                  </button>{' '}
                  yang berlaku untuk pendaftaran dan penggunaan akun Dashboard Faskes.
                </label>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting || !isPasswordValid || password !== rePassword || !captchaValue || !acceptTerms}
                className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-xs font-extrabold uppercase tracking-wider text-white shadow-md hover:bg-teal-800 transition-all active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <UserPlus className="h-5 w-5" />
                )}
                {submitting ? 'Mengajukan Pendaftaran...' : 'Kirim Pendaftaran'}
              </button>
            </form>
          </div>
        )}

        {/* OTP Step */}
        {step === 'otp' && (
          <div className="w-full max-w-[450px] mx-auto">
            {/* Header */}
            <div className="mb-7">
              <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
                Verifikasi Email
              </span>
              <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-tight text-slate-900">
                Masukkan Kode OTP
              </h2>
              <p className="mt-1 text-slate-500 text-sm">
                Kode OTP 4-digit telah dikirim ke email <span className="font-semibold text-slate-800">{email}</span>.
              </p>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700">
                  <AlertCircle className="mt-px h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-slate-700">Kode OTP (4 Digit)</label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition-all focus-within:border-teal-500 focus-within:bg-white">
                  <KeyRound className="h-[18px] w-[18px] text-slate-450" />
                  <input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    required
                    placeholder="Masukkan 4 digit OTP"
                    maxLength={4}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm tracking-widest text-slate-900 outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={verifyingOtp}
                className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-xs font-extrabold uppercase tracking-wider text-white hover:bg-teal-800 transition-all shadow-md disabled:opacity-75 disabled:cursor-wait"
              >
                {verifyingOtp ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Check className="h-5 w-5" />
                )}
                {verifyingOtp ? 'Memverifikasi...' : 'Verifikasi OTP'}
              </button>

              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || resendingOtp}
                className="w-full text-center text-xs font-semibold text-teal-600 hover:text-teal-700 mt-2 disabled:opacity-55 disabled:cursor-not-allowed hover:underline"
              >
                {resendCooldown > 0 ? `Kirim Ulang OTP dalam ${resendCooldown}s` : 'Kirim Ulang OTP'}
              </button>
            </form>
          </div>
        )}

        {/* Success Step */}
        {step === 'success' && (
          <div className="w-full max-w-[500px] mx-auto text-center space-y-6">
            <CheckCircle2 className="h-16 w-16 text-teal-600 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-2xl font-bold text-slate-900">Email Terverifikasi</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto">
                {successMessage} Akun Anda saat ini berstatus pending dan sedang menunggu persetujuan (approval) oleh Admin Pusat.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="inline-flex h-12 items-center justify-center rounded-xl bg-teal-700 px-8 text-xs font-bold uppercase tracking-wider text-white hover:bg-teal-800 transition-colors shadow-md"
              >
                Kembali ke Login
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* Syarat & Ketentuan Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-[#c8dedd] flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h3 className="text-lg font-extrabold text-slate-900">
                Syarat & Ketentuan Pengguna
              </h3>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-6 py-5 text-sm text-slate-600 space-y-4 leading-relaxed scrollbar-thin">
              <p>
                Selamat datang di <strong>Dashboard Fasilitas Kesehatan (Dashboard Faskes)</strong>. Dengan mendaftar dan menggunakan sistem ini, Anda setuju untuk mematuhi ketentuan di bawah ini:
              </p>

              <h4 className="font-extrabold text-slate-800 text-[13px] uppercase tracking-wider">1. Hak Akses & Akun</h4>
              <p className="pl-3 border-l-2 border-teal-500 text-slate-600">
                Penggunaan akun ini terbatas untuk tujuan penelitian, riset, pemantauan nasional, dan keperluan kedinasan/lintas sektor resmi. Anda bertanggung jawab penuh atas kerahasiaan kata sandi dan aktivitas akun Anda.
              </p>

              <h4 className="font-extrabold text-slate-800 text-[13px] uppercase tracking-wider">2. Penggunaan Data</h4>
              <p className="pl-3 border-l-2 border-teal-500 text-slate-600">
                Data sarana fasilitas kesehatan, wilayah BPS, dan laporan bencana yang diperoleh melalui sistem ini hanya boleh digunakan sesuai tujuan akses yang diajukan. Dilarang menyebarkan, memanipulasi, atau menyalahgunakan data yang dapat membahayakan privasi atau operasional fasilitas kesehatan.
              </p>

              <h4 className="font-extrabold text-slate-800 text-[13px] uppercase tracking-wider">3. Verifikasi & Validasi</h4>
              <p className="pl-3 border-l-2 border-teal-500 text-slate-600">
                Pendaftaran akun Anda memerlukan verifikasi email melalui OTP dan persetujuan manual oleh Administrator Pusat. Kami berhak menangguhkan atau menghapus akun jika ditemukan pelanggaran atau pemalsuan data diri.
              </p>

              <h4 className="font-extrabold text-slate-800 text-[13px] uppercase tracking-wider">4. Keamanan Sistem</h4>
              <p className="pl-3 border-l-2 border-teal-500 text-slate-600">
                Sistem ini dilindungi oleh mekanisme keamanan berlapis, termasuk captcha dan verifikasi akses. Setiap percobaan akses ilegal, peretasan, atau aktivitas mencurigakan lainnya akan diproses sesuai hukum yang berlaku di Republik Indonesia.
              </p>

              <p className="text-[12px] text-slate-400 pt-2 border-t border-slate-100">
                Terakhir diperbarui: 15 Juni 2026<br />
                Kementerian Kesehatan Republik Indonesia.
              </p>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 bg-slate-50 rounded-b-3xl border-t border-slate-100 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setAcceptTerms(true)
                  setShowTermsModal(false)
                }}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-teal-700 px-4 text-xs font-bold text-white hover:bg-teal-800 transition"
              >
                Setuju & Lanjutkan
              </button>
              <button
                type="button"
                onClick={() => setShowTermsModal(false)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-xs font-bold text-slate-650 hover:bg-slate-50 transition"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  )
}
