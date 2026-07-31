"use client"

import Link from 'next/link'
import { ArrowLeft, Shield, Lock, Eye, Database, Globe, UserCheck, AlertTriangle, Settings2, Mail } from 'lucide-react'

import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'

const POLICY_DATE = 'July 9, 2026'

export default function PrivacyPage() {

  const openCookiePreferences = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('openCookiePreferences'));
    }
  };

  const sections = [
    {
      id: "introduction",
      icon: <Shield className="w-5 h-5 text-primary" />,
      title: "1. Summary",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Welcome to JJI (Just Journal It). We are a paid, closed-source trading analytics platform. 
            You pay us for a service, and we provide it. We do not sell your personal data, 
            your trading history, or your financial metrics to third-party data brokers, advertisers, 
            or anyone else. Your data is yours.
          </p>
        </div>
      )
    },
    {
      id: "data-collection",
      icon: <Database className="w-5 h-5 text-primary" />,
      title: "2. The Data We Collect",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li><strong>Account Information:</strong> Your email address and basic profile information used for authentication.</li>
            <li><strong>Financial & Trading Data:</strong> The trades, journal entries, broker imports, and analytics you generate or input into our platform.</li>
            <li><strong>Payment Information:</strong> Handled securely via our payment providers (e.g., Stripe, NOWPayments). We do not store your full credit card details.</li>
            <li><strong>Operational telemetry:</strong> Crash reports and sampled performance traces used to keep the service reliable. JJI does not enable session replay, advertising analytics, or default personal-data collection in monitoring.</li>
          </ul>
        </div>
      )
    },
    {
      id: "how-we-use",
      icon: <Lock className="w-5 h-5 text-primary" />,
      title: "3. How We Use Your Data",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>We use your information exclusively to:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Provide, maintain, and improve the JJI trading analytics service.</li>
            <li>Process your subscriptions and payments.</li>
            <li>Provide customer support and respond to your inquiries.</li>
            <li>Ensure the security and integrity of our platform.</li>
          </ul>
        </div>
      )
    },
    {
      id: "third-parties",
      icon: <Globe className="w-5 h-5 text-primary" />,
      title: "4. Third-Party Integrations",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            To run the platform, we use trusted third-party services (e.g., cloud hosting, payment gateways, and email providers). These service providers are bound by strict confidentiality agreements and are only permitted to process your data to provide their respective services.
          </p>
          <p>
            AI features are opt-in. When you allow AI analysis, JJI sends your question and only the trading data sources you selected to xAI for response generation. Do not include secrets in prompts. JJI stores the resulting conversation in your workspace so you can return to it or delete it.
          </p>
        </div>
      )
    },
    {
      id: "cookies",
      icon: <Eye className="w-5 h-5 text-primary" />,
      title: "5. Cookies & Tracking",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            We use essential cookies and local storage to keep you logged in and remember app preferences. JJI does not use advertising or non-essential analytics cookies.
          </p>
          <div className="mt-4">
            <Button variant="outline" size="sm" onClick={openCookiePreferences} className="gap-2">
              <Settings2 className="w-4 h-4" />
              View Storage Notice
            </Button>
          </div>
        </div>
      )
    },
    {
      id: "security",
      icon: <AlertTriangle className="w-5 h-5 text-primary" />,
      title: "6. Data Security",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            We implement industry-standard security measures, including encryption in transit and at rest, to protect your trading data. While no system is 100% secure, we treat your financial data with the utmost care and restrict internal access to authorized personnel only.
          </p>
        </div>
      )
    },
    {
      id: "user-rights",
      icon: <UserCheck className="w-5 h-5 text-primary" />,
      title: "7. Your Rights",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            Depending on your location, you may have rights under the GDPR, CCPA, or other privacy laws. 
            You can request to access, correct, or delete your personal data by contacting our support team. 
            If you request account deletion, we will wipe your trading data from our active databases.
          </p>
        </div>
      )
    },
    {
      id: "retention",
      icon: <Database className="w-5 h-5 text-primary" />,
      title: "8. Retention & Deletion",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            We retain account and trading data for as long as needed to provide the service, meet security and payment obligations, or resolve disputes. You can request account and data deletion through the account controls or by contacting us. Some limited records may remain where retention is required by law or needed to prevent abuse.
          </p>
        </div>
      )
    },
    {
      id: "contact",
      icon: <Mail className="w-5 h-5 text-primary" />,
      title: "9. Contact",
      content: (
        <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
          <p>
            For privacy questions or requests, contact <a href="mailto:justjournalit1@gmail.com" className="text-primary hover:underline">justjournalit1@gmail.com</a>. Please include enough information for us to identify your account without sending passwords or authentication codes.
          </p>
        </div>
      )
    }
  ]

  return (
    <div className="min-h-screen bg-background selection:bg-primary/30 py-20 px-6">
      <div
        className="max-w-3xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700"
      >
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-3">
            <Logo className="w-8 h-8" />
            <span className="text-xl font-bold tracking-tight text-foreground">JJI</span>
          </div>
          <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-foreground transition-colors gap-2">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
        </div>

        <div className="space-y-12">
          <header className="space-y-3 mb-10 pb-8 border-b border-border/40">
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Privacy Policy</h1>
            <p className="text-lg text-muted-foreground leading-relaxed">Last updated: {POLICY_DATE}</p>
          </header>

          <div className="space-y-10">
            {sections.map((section, idx) => (
              <section 
                key={section.id}
                className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both"
                style={{ animationDelay: `${idx * 100}ms` }}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    {section.icon}
                  </div>
                  <h2 className="text-2xl font-semibold tracking-tight">{section.title}</h2>
                </div>
                <div className="pl-12">
                  {section.content}
                </div>
              </section>
            ))}
          </div>

          <footer className="pt-12 pb-8 border-t border-border/40 space-y-4 mt-16">
            <div className="flex flex-wrap gap-6 text-sm text-muted-foreground font-medium">
              <Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link>
              <Link href="/cookies" className="hover:text-primary transition-colors">Cookie Policy</Link>
              <Link href="mailto:justjournalit1@gmail.com" className="hover:text-primary transition-colors">Contact Us</Link>
            </div>
            <p className="text-xs text-muted-foreground uppercase tracking-widest font-semibold opacity-70">
              &copy; {new Date().getFullYear()} JJI. All rights reserved.
            </p>
          </footer>
        </div>
      </div>
    </div>
  )
}
