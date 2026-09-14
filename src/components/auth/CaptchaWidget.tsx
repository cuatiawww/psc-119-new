'use client'

import { RefreshCw, ShieldCheck } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { buildApiUrl } from '@/lib/utils/api'

interface CaptchaWidgetProps {
  onVerifyChange: (verified: boolean) => void
}

interface CaptchaResponse {
  id: string
  svg: string
}

export default function CaptchaWidget({ onVerifyChange }: CaptchaWidgetProps) {
  const [captchaId, setCaptchaId] = useState('')
  const [captchaSvg, setCaptchaSvg] = useState('')
  const [captchaText, setCaptchaText] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(false)
  const [error, setError] = useState('')

  const loadCaptcha = useCallback(async () => {
    setLoading(true)
    setError('')
    setVerified(false)
    onVerifyChange(false)

    try {
      const response = await fetch(buildApiUrl('/api/captcha'), {
        method: 'GET',
        cache: 'no-store',
      })

      const payload = (await response.json()) as Partial<CaptchaResponse>

      if (!response.ok || !payload.id || !payload.svg) {
        throw new Error('Gagal memuat CAPTCHA.')
      }

      setCaptchaId(payload.id)
      setCaptchaSvg(payload.svg)
      setCaptchaText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat CAPTCHA.')
    } finally {
      setLoading(false)
    }
  }, [onVerifyChange])

  useEffect(() => {
    void loadCaptcha()
  }, [loadCaptcha])

  const handleVerify = async () => {
    if (!captchaId || !captchaText.trim()) {
      setError('Masukkan kode CAPTCHA terlebih dahulu.')
      setVerified(false)
      onVerifyChange(false)
      return
    }

    setVerifying(true)
    setError('')

    try {
      const response = await fetch(buildApiUrl('/api/captcha/validate'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: captchaId,
          text: captchaText,
        }),
      })

      const payload = (await response.json()) as { success?: boolean }

      if (!response.ok || !payload.success) {
        setVerified(false)
        onVerifyChange(false)
        await loadCaptcha()
        throw new Error('CAPTCHA tidak valid atau sudah kedaluwarsa.')
      }

      setVerified(true)
      onVerifyChange(true)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Verifikasi CAPTCHA gagal.',
      )
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-bold text-slate-700">CAPTCHA</p>
          <p className="text-[12px] text-slate-500">
            Berlaku 2 menit dan hanya bisa dipakai sekali.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadCaptcha()}
          disabled={loading || verifying}
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-[13px] font-semibold text-slate-700 transition hover:border-teal-500 hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Muat ulang
        </button>
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-3">
        {captchaSvg ? (
          <div
            aria-label="CAPTCHA SVG"
            className="flex min-h-16 items-center justify-center"
            dangerouslySetInnerHTML={{ __html: captchaSvg }}
          />
        ) : (
          <div className="flex min-h-16 items-center justify-center text-sm text-slate-400">
            {loading ? 'Memuat CAPTCHA...' : 'CAPTCHA belum tersedia.'}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={captchaText}
          maxLength={5}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          readOnly={verified}
          onChange={(event) => {
            setCaptchaText(event.target.value)
            if (verified) {
              setVerified(false)
              onVerifyChange(false)
            }
          }}
          placeholder="Masukkan 5 karakter CAPTCHA"
          className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-[14px] text-slate-900 outline-none transition focus:border-teal-500 focus:shadow-[0_0_0_3px_rgba(20,184,166,0.12)]"
        />

        <button
          type="button"
          onClick={() => void handleVerify()}
          disabled={loading || verifying}
          className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 text-sm font-bold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <ShieldCheck className="h-4 w-4" />
          {verifying ? 'Memverifikasi...' : verified ? 'Captcha terverifikasi' : 'Verifikasi Captcha'}
        </button>
      </div>

      {error ? (
        <p className="text-[13px] font-medium text-rose-600">{error}</p>
      ) : null}

      {verified ? (
        <p className="text-[13px] font-medium text-emerald-600">
          CAPTCHA valid. Anda bisa melanjutkan login.
        </p>
      ) : null}
    </div>
  )
}
