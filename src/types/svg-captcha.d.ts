declare module 'svg-captcha' {
  export interface CreateOptions {
    size?: number
    ignoreChars?: string
    noise?: number
    color?: boolean
    background?: string
    width?: number
    height?: number
    fontSize?: number
    charPreset?: string
  }

  export interface CaptchaData {
    data: string
    text: string
  }

  export function create(options?: CreateOptions): CaptchaData

  const svgCaptcha: {
    create: typeof create
  }

  export default svgCaptcha
}
