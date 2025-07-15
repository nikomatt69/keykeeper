import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'

export default function ThemeToggle() {
    const [isDark, setIsDark] = useState(false)

    useEffect(() => {
        // Check localStorage for saved theme; default to light
        const savedTheme = localStorage.getItem('theme')
        if (savedTheme) {
            setIsDark(savedTheme === 'dark')
            updateTheme(savedTheme === 'dark')
        } else {
            setIsDark(false)
            updateTheme(false)
        }
    }, [])

    const updateTheme = (dark: boolean) => {
        if (dark) {
            document.documentElement.classList.add('dark')
        } else {
            document.documentElement.classList.remove('dark')
        }
    }

    const toggleTheme = () => {
        const newIsDark = !isDark
        setIsDark(newIsDark)
        updateTheme(newIsDark)
        localStorage.setItem('theme', newIsDark ? 'dark' : 'light')
    }

    return (
        <motion.button
            onClick={toggleTheme}
            className="btn-secondary p-3 hover-lift focus-native"
            style={{
                borderRadius: 'var(--radius-md)',
                minWidth: '44px',
                minHeight: '44px'
            }}
            whileTap={{ scale: 0.95 }}
            transition={{ duration: 0.2 }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
            <motion.div
                initial={false}
                animate={{
                    rotate: isDark ? 180 : 0,
                    scale: isDark ? 0.8 : 1
                }}
                transition={{
                    duration: 0.3,
                    type: "spring",
                    stiffness: 200,
                    damping: 20
                }}
            >
                {isDark ? (
                    <Sun className="h-5 w-5 text-contrast-medium" />
                ) : (
                    <Moon className="h-5 w-5 text-contrast-medium" />
                )}
            </motion.div>
        </motion.button>
    )
} 