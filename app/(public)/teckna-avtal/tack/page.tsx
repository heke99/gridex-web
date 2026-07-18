import type { Metadata } from 'next'
import SignupThanksPage from './SignupThanksPage'

export const metadata: Metadata = {
  title: 'Teckning mottagen – Gridex',
  description: 'Bekräftelse på att Gridex har tagit emot din teckning.',
  robots: { index: false, follow: false },
}

export default SignupThanksPage
