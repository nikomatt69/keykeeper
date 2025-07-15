import type { AppProps } from 'next/app'
import { Inter, JetBrains_Mono } from 'next/font/google'
import '../styles/globals.css'

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
      <Component {...pageProps} />
    </div>
  )
}
