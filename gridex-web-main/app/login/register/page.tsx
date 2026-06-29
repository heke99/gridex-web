import { redirect } from 'next/navigation'

export default function LoginRegisterRedirectPage() {
  redirect('/register')
}