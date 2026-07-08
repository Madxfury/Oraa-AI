/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                heading: ['Outfit', 'sans-serif'],
            },
            colors: {
                dark: {
                    950: '#050505',
                    900: '#0a0a0a',
                    800: '#171717',
                    700: '#262626',
                },
                primary: {
                    400: '#60a5fa',
                    500: '#3b82f6',
                    600: '#2563eb',
                },
                accent: {
                    500: '#8b5cf6', // Soft violet glow
                }
            },
            animation: {
                'glow-pulse': 'glow 3s ease-in-out infinite',
            },
            keyframes: {
                glow: {
                    '0%, 100%': { opacity: 0.5 },
                    '50%': { opacity: 1 },
                },
                slideRight: {
                    '0%': { transform: 'translateX(-100%)' },
                    '100%': { transform: 'translateX(300%)' },
                }
            }
        },
    },
    plugins: [],
}
