import { redirect } from 'next/navigation'

const pscLoginUrl = 'https://psc.kemkes.go.id/site/login'

export default function LoginPage() {
  redirect(pscLoginUrl)
}
