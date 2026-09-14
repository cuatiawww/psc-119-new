import { Redis } from '@upstash/redis'

import type { CaptchaRecord, CaptchaStore } from './types'

const keyFor = (id: string) => `captcha:${id}`

export class UpstashCaptchaStore implements CaptchaStore {
  private redis: Redis

  constructor() {
    this.redis = Redis.fromEnv()
  }

  async set(id: string, record: CaptchaRecord, ttlSeconds: number): Promise<void> {
    await this.redis.set(keyFor(id), JSON.stringify(record), {
      ex: ttlSeconds,
    })
  }

  async get(id: string): Promise<CaptchaRecord | null> {
    const payload = await this.redis.get<string>(keyFor(id))

    if (!payload) {
      return null
    }

    return JSON.parse(payload) as CaptchaRecord
  }

  async delete(id: string): Promise<void> {
    await this.redis.del(keyFor(id))
  }
}
