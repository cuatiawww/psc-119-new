'use client'

import { FormEvent, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AlertCircle, CheckCircle2, Loader2, ArrowLeft, Mail, KeyRound, LockKeyhole, Check, X } from 'lucide-react'
import { buildApiUrl } from '@/lib/utils/api'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

type ResetResponse = {
  success?: boolean
  message?: string
  errors?: Record<string, string>
}

export default function ForgotPasswordPage() {
  const baseApiUrl = useMemo(() => buildApiUrl('/api'), [])

  // UI Flow State: 'request' | 'reset' | 'success'
  const [step, setStep] = useState<'request' | 'reset' | 'success'>('request')

  // Form states
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  // Loading & error states
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [, setMessage] = useState('')

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

  const isPasswordValid = pwdChecks.minLength && pwdChecks.hasUpper && pwdChecks.hasLower && pwdChecks.hasNumber && pwdChecks.hasSpecial

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

  // Handle request OTP (Step 1)
  const handleRequestOtp = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})
    setSubmitting(true)

    try {
      const response = await fetch(`${baseApiUrl}/forgot-password-request`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ email: email.trim() }),
      })

      const payload = (await response.json().catch(() => null)) as ResetResponse | null

      if (!response.ok || !payload?.success) {
        if (payload?.errors) {
          setFieldErrors(payload.errors)
        }
        throw new Error(payload?.message || 'Gagal mengirim OTP. Email tidak terdaftar?')
      }

      setMessage(payload.message || 'OTP berhasil dikirim.')
      setStep('reset')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  // Handle verify OTP & reset password (Step 2)
  const handleResetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setFieldErrors({})

    if (!isPasswordValid) {
      setError('Password baru belum memenuhi seluruh kriteria keamanan.')
      return
    }

    if (password !== passwordConfirm) {
      setFieldErrors({ password_confirm: 'Konfirmasi password tidak cocok.' })
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(`${baseApiUrl}/forgot-password-verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          password,
          password_confirm: passwordConfirm,
        }),
      })

      const payload = (await response.json().catch(() => null)) as ResetResponse | null

      if (!response.ok || !payload?.success) {
        if (payload?.errors) {
          setFieldErrors(payload.errors)
        }
        throw new Error(payload?.message || 'Gagal merubah password. Periksa OTP Anda.')
      }

      setStep('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Terjadi kesalahan. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
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

      <div className="relative z-10 w-full max-w-[450px] bg-white rounded-3xl border border-[#c8dedd] shadow-[0_25px_70px_rgba(0,0,0,0.25)] p-7 sm:p-10">

        {/* Back Link */}
        <Link href="/login" className="inline-flex items-center gap-2 text-teal-600 hover:text-teal-700 font-semibold text-sm mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Halaman Masuk
        </Link>

        {/* Step 1: Request Reset OTP */}
        {step === 'request' && (
          <div>
            <div className="mb-7">
              <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
                Lupa Password
              </span>
              <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-tight text-slate-900">
                Pemulihan Sandi
              </h2>
              <p className="mt-1 text-slate-500 text-sm">
                Masukkan alamat email Anda untuk menerima kode OTP pemulihan kata sandi.
              </p>
            </div>

            <form onSubmit={handleRequestOtp} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700">
                  <AlertCircle className="mt-px h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-slate-700">Alamat Email</label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition-all focus-within:border-teal-500 focus-within:bg-white">
                  <Mail className="h-[18px] w-[18px] text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Masukkan email terdaftar"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                  />
                </div>
                {fieldErrors.email && <p className="mt-1 text-xs text-red-600 font-medium">{fieldErrors.email}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-xs font-extrabold uppercase tracking-wider text-white hover:bg-teal-800 transition-all shadow-md disabled:opacity-75 disabled:cursor-wait"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Mail className="h-5 w-5" />
                )}
                {submitting ? 'Mengirim OTP...' : 'Kirim Kode OTP'}
              </button>
            </form>
          </div>
        )}

        {/* Step 2: Reset Password (Input OTP & Password Baru) */}
        {step === 'reset' && (
          <div>
            <div className="mb-7">
              <span className="inline-block rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-teal-700">
                Verifikasi OTP
              </span>
              <h2 className="mt-3 text-[28px] font-extrabold leading-tight tracking-tight text-slate-900">
                Sandi Baru
              </h2>
              <p className="mt-1 text-slate-500 text-sm">
                Kode OTP telah dikirim ke <span className="font-semibold text-slate-800">{email}</span>. Silakan isi form di bawah.
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              {error && (
                <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 px-3.5 py-3 text-[13px] font-medium text-red-700">
                  <AlertCircle className="mt-px h-4 w-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* OTP */}
              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-slate-700">Kode OTP (6 Digit)</label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition-all focus-within:border-teal-500 focus-within:bg-white">
                  <KeyRound className="h-[18px] w-[18px] text-slate-450" />
                  <input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    required
                    placeholder="Masukkan 6 digit angka"
                    maxLength={6}
                    className="h-full min-w-0 flex-1 bg-transparent text-sm tracking-widest text-slate-900 outline-none"
                  />
                </div>
                {fieldErrors.otp && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.otp}</p>}
              </div>

              {/* Password Baru */}
              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-slate-700">Password Baru</label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition-all focus-within:border-teal-500 focus-within:bg-white">
                  <LockKeyhole className="h-[18px] w-[18px] text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Minimal 8 karakter"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                  />
                </div>
                {/* Realtime Password Checklist */}
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
                        {pwdChecks.minLength ? <Check className="h-3.5 w-3.5 text-teal-650" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                        <span className={pwdChecks.minLength ? 'text-teal-700 font-medium' : 'text-slate-500'}>Min. 8 karakter</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {pwdChecks.hasUpper ? <Check className="h-3.5 w-3.5 text-teal-650" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                        <span className={pwdChecks.hasUpper ? 'text-teal-700 font-medium' : 'text-slate-500'}>Huruf Besar (A-Z)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {pwdChecks.hasLower ? <Check className="h-3.5 w-3.5 text-teal-650" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                        <span className={pwdChecks.hasLower ? 'text-teal-700 font-medium' : 'text-slate-500'}>Huruf Kecil (a-z)</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {pwdChecks.hasNumber ? <Check className="h-3.5 w-3.5 text-teal-650" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                        <span className={pwdChecks.hasNumber ? 'text-teal-700 font-medium' : 'text-slate-500'}>Angka (0-9)</span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        {pwdChecks.hasSpecial ? <Check className="h-3.5 w-3.5 text-teal-650" /> : <X className="h-3.5 w-3.5 text-red-500" />}
                        <span className={pwdChecks.hasSpecial ? 'text-teal-700 font-medium' : 'text-slate-500'}>Karakter Khusus (@$!%*?&)</span>
                      </div>
                    </div>
                  </div>
                )}
                {fieldErrors.password && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.password}</p>}
              </div>

              {/* Konfirmasi Password */}
              <div>
                <label className="mb-1.5 block text-[13px] font-bold text-slate-700">Konfirmasi Password</label>
                <div className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3.5 transition-all focus-within:border-teal-500 focus-within:bg-white">
                  <LockKeyhole className="h-[18px] w-[18px] text-slate-400" />
                  <input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    required
                    placeholder="Masukkan ulang password"
                    className="h-full min-w-0 flex-1 bg-transparent text-sm text-slate-900 outline-none"
                  />
                </div>
                {/* Match Check */}
                {passwordConfirm.length > 0 && (
                  <div className="mt-2.5 flex items-center gap-1.5 text-xs">
                    {password === passwordConfirm ? (
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
                {fieldErrors.password_confirm && <p className="mt-1 text-xs text-red-650 font-medium">{fieldErrors.password_confirm}</p>}
              </div>

              <button
                type="submit"
                disabled={submitting || !isPasswordValid || password !== passwordConfirm}
                className="w-full inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-xs font-extrabold uppercase tracking-wider text-white hover:bg-teal-800 transition-all shadow-md disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <LockKeyhole className="h-5 w-5" />
                )}
                {submitting ? 'Menyimpan Sandi...' : 'Ubah Kata Sandi'}
              </button>

              <button
                type="button"
                onClick={() => setStep('request')}
                className="w-full text-center text-xs font-semibold text-teal-600 hover:text-teal-700 mt-2 hover:underline animate-fade"
              >
                Minta OTP Baru
              </button>
            </form>
          </div>
        )}

        {/* Step 3: Success Screen */}
        {step === 'success' && (
          <div className="text-center space-y-5">
            <CheckCircle2 className="h-14 w-14 text-teal-650 mx-auto" />
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-slate-900">Kata Sandi Diubah</h3>
              <p className="text-sm text-slate-500">
                Kata sandi Anda berhasil diperbarui. Silakan login kembali dengan sandi baru Anda.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/login"
                className="w-full inline-flex h-12 items-center justify-center rounded-xl bg-teal-700 px-4 text-xs font-extrabold uppercase tracking-wider text-white hover:bg-teal-800 transition-all shadow-md"
              >
                Masuk Sekarang
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
