import type { Metadata } from "next";
import { inter } from "@/lib/fonts";
import "./globals.css";
import { SafeToaster } from "@/components/safe-toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
// Removed Vercel Analytics and Speed Insights to comply with essential-only cookie policy
import { AuthProvider } from "@/context/auth-provider";
import { CookieConsent } from "@/components/ui/cookie-consent";
import { ThemeProvider } from "@/context/theme-provider";
import { QueryProvider } from "@/lib/query/query-provider";
import { ErrorBoundaryWrapper } from "@/components/error-boundary";
import { ServiceWorkerRegister } from "@/components/service-worker-register";
import { RouteAwareFooter } from "@/components/route-aware-footer";
import { headers } from 'next/headers'
import { BRAND } from '@/lib/constants/brand'

const DEFAULT_SITE_URL = BRAND.siteUrl
const SITE_NAME = BRAND.name
const SITE_DESCRIPTION = `${BRAND.fullName} - ${BRAND.tagline}`
const SOCIAL_PREVIEW_VERSION = 'jji-20260522'
const rawSiteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_URL
const normalizedSiteUrl = rawSiteUrl.startsWith('http') ? rawSiteUrl : `https://${rawSiteUrl}`
const socialImage = `/opengraph-image.png?v=${SOCIAL_PREVIEW_VERSION}`
const twitterImage = `/twitter-image.png?v=${SOCIAL_PREVIEW_VERSION}`

export const viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: 'white' },
    { media: '(prefers-color-scheme: dark)', color: 'black' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(normalizedSiteUrl),
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  appleWebApp: {
    title: SITE_NAME,
    capable: true,
    statusBarStyle: 'black-translucent',
  },
  openGraph: {
    type: 'website',
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    url: normalizedSiteUrl,
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: 'JJI social preview',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_NAME,
    description: SITE_DESCRIPTION,
    images: [twitterImage],
  },
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: 'any' },
      { url: '/icon.png', type: 'image/png', sizes: '32x32' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  manifest: '/site.webmanifest',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get('x-nonce') || undefined
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  return (
    <html lang="en" className={`${inter.variable} dark`} suppressHydrationWarning>
      <head>
        <meta name="application-name" content={BRAND.name} />

        {/* Analytics removed to comply with essential-only cookie policy */}

        {/* Performance: Preconnect to Supabase for faster API calls */}
        {supabaseUrl && <link rel="preconnect" href={supabaseUrl} crossOrigin="anonymous" />}
        {supabaseUrl && <link rel="dns-prefetch" href={supabaseUrl} />}

        <link
          rel="apple-touch-icon"
          sizes="180x180"
          href="/apple-touch-icon.png"
        />
        <link
          rel="apple-touch-icon-precomposed"
          sizes="180x180"
          href="/apple-touch-icon-precomposed.png"
        />
        <script
          id="theme-script"
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var r=document.documentElement;r.style.colorScheme="dark",r.classList.contains("dark")||r.classList.add("dark");var t=localStorage.getItem("theme")||"dark",e=t;"system"===t&&(e=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"),"light"!==e&&"dark"!==e&&(e="dark"),"light"===e?(r.classList.remove("dark"),r.classList.add("light"),r.style.colorScheme="light"):(r.classList.remove("light"),r.classList.add("dark"),r.style.colorScheme="dark");var a=localStorage.getItem("accentPack")||"classic";r.classList.remove("accent-reports","accent-violet","accent-slate"),"reports"===a?r.classList.add("accent-reports"):"violet"===a?r.classList.add("accent-violet"):"slate"===a&&r.classList.add("accent-slate")}catch(c){document.documentElement.classList.add("dark"),document.documentElement.style.colorScheme="dark"}})();`,
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans min-h-screen flex flex-col overflow-x-clip w-full`}>
        <ErrorBoundaryWrapper showDetails={process.env.NODE_ENV === 'development'}>
          <ThemeProvider>
            <QueryProvider>
              <AuthProvider>
                <TooltipProvider>
                  <ServiceWorkerRegister />
                  <CookieConsent />
                  <SafeToaster />
                  <div className="flex-1 flex flex-col">
                    {children}
                  </div>
                  <RouteAwareFooter />
                </TooltipProvider>
              </AuthProvider>
            </QueryProvider>
          </ThemeProvider>
        </ErrorBoundaryWrapper>
      </body>
    </html>
  );
}
