import { cn } from "@/lib/utils";

export function Logo({ className, transparent = false }: { className?: string; transparent?: boolean }) {
    if (transparent) {
        return (
            <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={cn("fill-current", className)} aria-label="JJI logo" role="img">
                <path d="M128 136h256v72H292v216h-72V208h-92z" />
            </svg>
        )
    }
    return (
        <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" className={cn("fill-foreground", className)} aria-label="JJI logo" role="img">
            <rect width="512" height="512" rx="104" className="fill-current opacity-100" />
            <path className="fill-background" d="M128 136h256v72H292v216h-72V208h-92z" />
        </svg>
    )
}

function LogoText() {
    return (
        <svg width="256" height="64" viewBox="0 0 1180 260" fill="none" xmlns="http://www.w3.org/2000/svg" className="fill-foreground" aria-label="JJI wordmark" role="img">
            <rect width="260" height="260" rx="52" className="fill-current" />
            <path className="fill-background" d="M65 69h130v37h-47v110h-36V106H65z" />
            <text x="310" y="166" fontFamily="DM Sans, Arial, Helvetica, sans-serif" fontSize="106" fontWeight="700" letterSpacing="-2" className="fill-current">JJI</text>
        </svg>
    )
}
