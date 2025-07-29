import type { AppProps } from 'next/app'
import { Inter, JetBrains_Mono } from 'next/font/google'
import '../styles/globals.css'
import AuthManager from '../components/AuthManager'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains-mono',
})

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className={`${inter.variable} ${jetbrainsMono.variable} font-sans`}>
      <AuthManager>
        <Component {...pageProps} />
      </AuthManager>
    </div>
  )
}
