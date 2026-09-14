export interface CaptchaRecord {
  answer: string
  createdAt: number
  expiresAt: number
}

export interface CaptchaStore {
  set(id: string, record: CaptchaRecord, ttlSeconds: number): Promise<void>
  get(id: string): Promise<CaptchaRecord | null>
  delete(id: string): Promise<void>
}
