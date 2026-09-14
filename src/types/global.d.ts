export {}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ol?: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Chart?: any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    webkitAudioContext?: any
    __fetch_intercepted__?: boolean
  }
}
