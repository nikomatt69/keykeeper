import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: string | Date, locale: string = 'en-US') {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export function formatDateTime(date: string | Date, locale: string = 'en-US') {
  return new Date(date).toLocaleDateString(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

export function formatKey(key: string, isVisible: boolean = false) {
  if (isVisible) return key
  if (key.length <= 12) return key
  return key.slice(0, 8) + '•'.repeat(Math.max(0, key.length - 12)) + key.slice(-4)
}

export function getDaysUntilExpiry(expiresAt: string | undefined): number | null {
  if (!expiresAt) return null
  const expiryDate = new Date(expiresAt)
  const now = new Date()
  return Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
}

export function isExpired(expiresAt: string | undefined): boolean {
  if (!expiresAt) return false
  return new Date(expiresAt) < new Date()
}

export function isExpiringSoon(expiresAt: string | undefined, daysThreshold: number = 30): boolean {
  if (!expiresAt) return false
  const days = getDaysUntilExpiry(expiresAt)
  return days !== null && days <= daysThreshold && days > 0
}

export function getEnvironmentColor(environment: string) {
  switch (environment) {
    case 'production':
      return 'bg-danger-100 text-danger-700 border-danger-200'
    case 'staging':
      return 'bg-warning-100 text-warning-700 border-warning-200'
    case 'dev':
      return 'bg-success-100 text-success-700 border-success-200'
    default:
      return 'bg-primary-100 text-primary-700 border-primary-200'
  }
}

export function generateId(): string {
  return crypto.randomUUID()
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text)
}

export function validateApiKey(key: string): boolean {
  // Basic validation - puoi personalizzare in base ai tuoi requisiti
  return key.length >= 8 && key.trim().length > 0
}

export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function debounce<T extends (...args: any[]) => void>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout
  return (...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => func(...args), delay)
  }
}

export function throttle<T extends (...args: any[]) => void>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args)
      inThrottle = true
      setTimeout(() => (inThrottle = false), limit)
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

export function getRandomColor(): string {
  const colors = [
    'bg-red-100 text-red-700',
    'bg-yellow-100 text-yellow-700',
    'bg-green-100 text-green-700',
    'bg-blue-100 text-blue-700',
    'bg-purple-100 text-purple-700',
    'bg-pink-100 text-pink-700',
    'bg-indigo-100 text-indigo-700',
    'bg-gray-100 text-gray-700'
  ]
  return colors[Math.floor(Math.random() * colors.length)]
}

export function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength) + '...'
}

export function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}