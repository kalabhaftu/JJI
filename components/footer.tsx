import Link from 'next/link'
import { Logo } from '@/components/logo'

export function Footer() {
  return (
    <footer className="border-t border-border/20 py-8 px-6 bg-background mt-auto">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Logo className="w-5 h-5" />
          <span className="text-xs text-muted-foreground font-medium">
            &copy; {new Date().getFullYear()} JJI.
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          <Link href="/docs" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
            Docs
          </Link>
          <Link href="/privacy" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
            Privacy
          </Link>
          <Link href="/terms" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
            Terms
          </Link>
          <Link href="/contact" className="text-xs text-muted-foreground hover:text-foreground transition-colors font-medium">
            Contact
          </Link>
        </div>
      </div>
    </footer>
  )
}
