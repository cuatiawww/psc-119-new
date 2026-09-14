import type { CaptchaRecord, CaptchaStore } from './types'

const records = new Map<string, CaptchaRecord>()

const isExpired = (record: CaptchaRecord) => record.expiresAt <= Date.now()

export class MemoryCaptchaStore implements CaptchaStore {
  async set(
    id: string,
    record: CaptchaRecord,
    _ttlSeconds: number,
  ): Promise<void> {
    this.cleanup()
    records.set(id, record)
  }

  async get(id: string): Promise<CaptchaRecord | null> {
    this.cleanup()
    const record = records.get(id)
    if (!record) {
      return null
    }

    if (isExpired(record)) {
      records.delete(id)
      return null
    }

    return record
  }

  async delete(id: string): Promise<void> {
    records.delete(id)
  }

  private cleanup() {
    for (const [id, record] of records.entries()) {
      if (isExpired(record)) {
        records.delete(id)
      }
    }
  }
}
