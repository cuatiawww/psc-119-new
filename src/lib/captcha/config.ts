export const CAPTCHA_LENGTH = 5
export const CAPTCHA_TTL_SECONDS = 2 * 60
export const CAPTCHA_COOKIE_NAME = 'captcha-verified'
export const CAPTCHA_COOKIE_MAX_AGE_SECONDS = 2 * 60

export const normalizeCaptchaText = (value: string) => value.trim().toLowerCase()
