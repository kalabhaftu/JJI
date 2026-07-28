import type { Config } from "tailwindcss";

const config: Config = {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{js,ts,jsx,tsx,mdx}",
		"./components/**/*.{js,ts,jsx,tsx,mdx}",
		"./app/**/*.{js,ts,jsx,tsx,mdx}",
		"./src/**/*.{ts,tsx}",
		"./node_modules/onborda/dist/**/*.{js,ts,jsx,tsx}"
	],
	theme: {
		extend: {
			fontFamily: {
				sans: ['var(--font-system)', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
				satoshi: ['var(--font-system)', '-apple-system', 'BlinkMacSystemFont', 'SF Pro Display', 'SF Pro Text', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
			},
			backgroundImage: {
				'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
				'gradient-conic': 'conic-gradient(at 50% 50%, var(--tw-gradient-stops))'
			},
			height: {
				'widget-kpi': '140px',
				'widget-tiny': '180px',
				'widget-small': '580px',
				'widget-small-long': '360px',
				'widget-medium': '580px',
				'widget-large': '580px',
				'widget-extra-large': '800px',
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			colors: {
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				'heading-text': 'hsl(var(--heading-text))',
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					hover: 'hsl(var(--primary-hover))',
					press: 'hsl(var(--primary-press))',
					disabled: 'hsl(var(--primary-disabled))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				chart: {
					'1': 'hsl(var(--chart-1))',
					'2': 'hsl(var(--chart-2))',
					'3': 'hsl(var(--chart-3))',
					'4': 'hsl(var(--chart-4))',
					'5': 'hsl(var(--chart-5))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				long: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				short: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				profit: 'hsl(var(--chart-profit))',
				loss: 'hsl(var(--chart-loss))',
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				}
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'in': {
					from: {
						opacity: '0',
						transform: 'scale(0.95)'
					},
					to: {
						opacity: '1',
						transform: 'scale(1)'
					}
				},
				'out': {
					from: {
						opacity: '1',
						transform: 'scale(1)'
					},
					to: {
						opacity: '0',
						transform: 'scale(0.95)'
					}
				},
				'fade-in': {
					from: {
						opacity: '0'
					},
					to: {
						opacity: '1'
					}
				},
				'fade-out': {
					from: {
						opacity: '1'
					},
					to: {
						opacity: '0'
					}
				},
				'slide-in-from-top': {
					from: {
						transform: 'translateY(-10px)'
					},
					to: {
						transform: 'translateY(0)'
					}
				},
				'slide-in-from-bottom': {
					from: {
						transform: 'translateY(10px)'
					},
					to: {
						transform: 'translateY(0)'
					}
				},
				'slide-in-from-left': {
					from: {
						transform: 'translateX(-10px)'
					},
					to: {
						transform: 'translateX(0)'
					}
				},
				'slide-in-from-right': {
					from: {
						transform: 'translateX(10px)'
					},
					to: {
						transform: 'translateX(0)'
					}
				},
				'scanner-smooth': {
					'0%': {
						top: '0%'
					},
					'50%': {
						top: 'calc(100% - 3px)'
					},
					'50.001%': {
						top: 'calc(100% - 3px)'
					},
					'100%': {
						top: '0%'
					}
				},
				'glow-subtle': {
					'0%': {
						opacity: '0.5'
					},
					'50%': {
						opacity: '0.7'
					},
					'100%': {
						opacity: '0.5'
					}
				},
				'glow-success': {
					'0%': {
						opacity: '0.5'
					},
					'50%': {
						opacity: '0.8'
					},
					'100%': {
						opacity: '0.5'
					}
				},
				'success-pulse': {
					'0%': {
						opacity: '0'
					},
					'50%': {
						opacity: '1'
					},
					'100%': {
						opacity: '0'
					}
				},
				'success-sweep': {
					'0%': {
						transform: 'translateX(-100%)'
					},
					'100%': {
						transform: 'translateX(100%)'
					}
				},
				'shimmer': {
					'0%': {
						transform: 'translateX(-100%)'
					},
					'100%': {
						transform: 'translateX(100%)'
					}
				},
				'luma-spin': {
					'0%': { inset: '0 35px 35px 0' },
					'12.5%': { inset: '0 35px 0 0' },
					'25%': { inset: '35px 35px 0 0' },
					'37.5%': { inset: '35px 0 0 0' },
					'50%': { inset: '35px 0 0 35px' },
					'62.5%': { inset: '0 0 0 35px' },
					'75%': { inset: '0 0 35px 35px' },
					'87.5%': { inset: '0 0 35px 0' },
					'100%': { inset: '0 35px 35px 0' }
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'scanner-smooth': 'scanner-smooth 8s cubic-bezier(0.4, 0, 0.6, 1) infinite',
				'glow-subtle': 'glow-subtle 3s ease-in-out infinite',
				'glow-success': 'glow-success 2s ease-in-out infinite',
				'success-pulse': 'success-pulse 3s ease-in-out infinite',
				'success-sweep': 'success-sweep 1.5s ease-in-out forwards',
				'shimmer': 'shimmer 2s ease-in-out infinite',
				'in': 'in 0.2s ease-out',
				'out': 'out 0.2s ease-out',
				'fade-in': 'fade-in 0.2s ease-out',
				'fade-out': 'fade-out 0.2s ease-out',
				'slide-in-from-top': 'slide-in-from-top 0.2s ease-out',
				'slide-in-from-bottom': 'slide-in-from-bottom 0.2s ease-out',
				'slide-in-from-left': 'slide-in-from-left 0.2s ease-out',
				'slide-in-from-right': 'slide-in-from-right 0.2s ease-out',
				'luma-spin': 'luma-spin 2.5s infinite'
			},
			typography: {
				DEFAULT: {
					css: {
						'code::before': {
							content: '""'
						},
						'code::after': {
							content: '""'
						},
						table: {
							width: '100%',
							marginTop: '1.5rem',
							marginBottom: '1.5rem',
							borderCollapse: 'collapse',
							fontSize: '0.875rem',
							lineHeight: '1.25rem',
							border: '1px solid var(--tw-prose-td-borders)'
						},
						thead: {
							backgroundColor: 'var(--tw-prose-th-borders)',
							borderWidth: '1px',
							borderStyle: 'solid',
							borderColor: 'var(--tw-prose-td-borders)'
						},
						'thead th': {
							padding: '1rem',
							fontWeight: '500',
							textAlign: 'left',
							backgroundColor: 'var(--tw-prose-th-borders)'
						},
						'tbody tr': {
							borderBottomWidth: '1px',
							borderBottomStyle: 'solid',
							borderBottomColor: 'var(--tw-prose-td-borders)'
						},
						'tbody td': {
							padding: '1rem',
							borderWidth: '1px',
							borderStyle: 'solid',
							borderColor: 'var(--tw-prose-td-borders)'
						}
					}
				}
			}
		}
	},
	plugins: [
		require("tailwindcss-animate"),
		require('@tailwindcss/typography'),
	],
};
export default config;
