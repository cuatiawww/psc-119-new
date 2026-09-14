import { v4 as uuidv4 } from 'uuid'

import {
  CAPTCHA_LENGTH,
  CAPTCHA_TTL_SECONDS,
  normalizeCaptchaText,
} from './config'
import { createCaptchaStore } from './store'

const store = createCaptchaStore()

export interface GeneratedCaptcha {
  id: string
  svg: string
}

export const generateCaptcha = async (): Promise<GeneratedCaptcha> => {
  const { default: svgCaptcha } = await import('svg-captcha')

  const challenge = svgCaptcha.create({
    size: CAPTCHA_LENGTH,
    noise: 4,
    ignoreChars: '0Oo1IiLl',
    width: 160,
    height: 56,
    fontSize: 42,
    color: true,
    background: '#f8fafc',
  })

  const id = uuidv4()
  const now = Date.now()

  await store.set(
    id,
    {
      answer: normalizeCaptchaText(challenge.text),
      createdAt: now,
      expiresAt: now + CAPTCHA_TTL_SECONDS * 1000,
    },
    CAPTCHA_TTL_SECONDS,
  )

  return {
    id,
    svg: challenge.data,
  }
}

export const validateCaptcha = async (id: string, text: string): Promise<boolean> => {
  const normalizedId = id.trim()
  const normalizedText = normalizeCaptchaText(text)

  if (!normalizedId || !normalizedText) {
    return false
  }

  const record = await store.get(normalizedId)

  if (!record) {
    return false
  }

  await store.delete(normalizedId)

  if (record.expiresAt <= Date.now()) {
    return false
  }

  return record.answer === normalizedText
}
