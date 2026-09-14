import { MemoryCaptchaStore } from './memory-store'
import { UpstashCaptchaStore } from './upstash-store'
import type { CaptchaStore } from './types'

const storeMode = process.env.CAPTCHA_STORE?.toLowerCase()

export const createCaptchaStore = (): CaptchaStore => {
  if (
    (storeMode === 'upstash' || storeMode === 'redis') &&
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    try {
      return new UpstashCaptchaStore()
    } catch (error) {
      console.error('Failed to initialize Upstash captcha store:', error)
      return new MemoryCaptchaStore()
    }
  }

  return new MemoryCaptchaStore()
}
