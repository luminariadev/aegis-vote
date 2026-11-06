/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				aegis: {
					bg: '#090d16',
					surface: '#0f172a',
					subtle: '#162032',
					border: '#1e293b',
					'border-light': '#334155',
					primary: '#10b981',
					'primary-hover': '#059669',
					cyan: '#06b6d4',
					violet: '#8b5cf6',
					amber: '#f59e0b',
					rose: '#f43f5e',
					text: '#f8fafc',
					muted: '#94a3b8'
				}
			},
			boxShadow: {
				'aegis-card': '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
				'aegis-glow': '0 0 25px -5px rgba(16, 185, 129, 0.25)',
				'aegis-cyan-glow': '0 0 25px -5px rgba(6, 182, 212, 0.25)',
			},
			fontFamily: {
				sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
				mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
			}
		}
	},
	plugins: []
};
