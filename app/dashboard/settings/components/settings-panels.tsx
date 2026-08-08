"use client"

import Link from "next/link"
import { HugeiconsIcon } from '@hugeicons/react'
import { Tick01Icon, CopyIcon, DatabaseIcon, RefreshIcon, Shield01Icon, Delete02Icon, WebhookIcon, Logout01Icon } from '@hugeicons/core-free-icons'
import { reportError } from '@/lib/observability/report-error'
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { LinkedAccounts } from "@/components/linked-accounts"
import { CacheManagement } from "./cache-management"
import { SettingsDangerZone } from "./settings-shell"
import { buildTradingViewWebhookExample } from "./settings-config"

type WebhookProps = {
  token: string | null
  loading: boolean
  copied: boolean
  regenerating: boolean
  onCopyUrl: () => void
  onRegenerate: () => void
}

export function SettingsIntegrations({ token, loading, copied, regenerating, onCopyUrl, onRegenerate }: WebhookProps) {
  return <section className="flex flex-col gap-6" aria-labelledby="settings-integrations-heading">
    <header><h2 id="settings-integrations-heading" className="text-lg font-semibold text-heading-text">Integrations</h2><p className="text-xs text-muted-foreground/85">Automate trade importing using third-party alerts and webhooks</p></header>
    <div className="flex flex-col gap-6" data-tour="settings-card-integrations">
      <div className="flex items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted"><HugeiconsIcon icon={WebhookIcon} className="size-5 text-muted-foreground" strokeWidth={1.5} color="currentColor" /></div><div><h3 className="text-sm font-semibold text-heading-text">TradingView Webhook</h3><p className="text-xs text-muted-foreground">Auto-import trades via TradingView alerts</p></div></div>
      <p className="text-xs text-muted-foreground/85">Paste this URL into the TradingView alert webhook field. The secret token does not go in the URL; it goes inside the JSON message body shown below.</p>
      <div className="flex items-center gap-2"><div className="min-w-0 flex-1 truncate border-b border-border/30 py-2.5 font-mono text-[11px] text-muted-foreground">{loading ? <Skeleton className="h-3.5 w-full" /> : token ? `${typeof window !== 'undefined' ? window.location.origin : ''}/api/v1/import/webhook/tradingview?token=${token}` : 'Loading...'}</div><Button variant="secondary" size="icon" aria-label={copied ? 'Webhook URL copied' : 'Copy webhook URL'} title={copied ? 'Copied' : 'Copy webhook URL'} className="size-9 shrink-0" disabled={!token || loading} onClick={onCopyUrl}>{copied ? <HugeiconsIcon icon={Tick01Icon} className="size-4 text-success" strokeWidth={1.5} color="currentColor" /> : <HugeiconsIcon icon={CopyIcon} className="size-4" strokeWidth={1.5} color="currentColor" />}</Button></div>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-[10px] text-muted-foreground/60">Regenerating creates a new URL and invalidates the old one.</p><Button variant="secondary" size="sm" className="shrink-0 gap-2 text-xs" disabled={regenerating} onClick={onRegenerate}><HugeiconsIcon icon={RefreshIcon} className={regenerating ? 'size-3 animate-spin' : 'size-3'} strokeWidth={1.5} color="currentColor" />Regenerate Token</Button></div>
      <div className="flex flex-col gap-2 border-t border-border/20 pt-4"><div className="flex items-center justify-between gap-3"><p className="text-[11px] font-semibold text-heading-text">TradingView alert message body</p><Button variant="tertiary" size="sm" className="gap-1 px-2 text-xs" disabled={!token || loading} onClick={async () => { try { await navigator.clipboard.writeText(buildTradingViewWebhookExample(token)); toast.success('Webhook example copied') } catch (error) { reportError(error, { surface: 'client', operation: 'copy-webhook-example', route: '/dashboard/settings' }); toast.error('Could not copy webhook example') } }}><HugeiconsIcon icon={CopyIcon} className="size-3.5" strokeWidth={1.5} color="currentColor" />Copy JSON</Button></div><pre className="overflow-x-auto border-b border-border/20 bg-muted/10 p-3 text-[11px] leading-5 text-muted-foreground/90 font-mono">{buildTradingViewWebhookExample(token)}</pre><p className="text-[10px] leading-4 text-muted-foreground/70">Required fields: <code className="font-mono text-foreground">token</code>, <code className="font-mono text-foreground">symbol</code>, <code className="font-mono text-foreground">side</code>, <code className="font-mono text-foreground">entry_price</code>, <code className="font-mono text-foreground">close_price</code>.</p></div>
    </div>
  </section>
}

export function SettingsConnections() {
  return <section className="flex flex-col gap-6" aria-labelledby="settings-connections-heading"><header><h2 id="settings-connections-heading" className="text-lg font-semibold text-heading-text">Connections</h2><p className="text-xs text-muted-foreground/85">Manage the providers that can sign you in</p></header><div data-tour="settings-card-connections"><LinkedAccounts plain /></div></section>
}

type SecurityProps = { editingProfile: boolean; onSignOutPrompt: () => void; onDelete: () => void }
export function SettingsSecurity({ editingProfile, onSignOutPrompt, onDelete }: SecurityProps) {
  return <section className="flex flex-col gap-6" aria-labelledby="settings-security-heading"><header><h2 id="settings-security-heading" className="text-lg font-semibold text-heading-text">Security &amp; Data Management</h2><p className="text-xs text-muted-foreground/85">Manage your local storage cache, export data, sign out, or delete your account</p></header><div data-tour="settings-card-security"><CacheManagement plain /></div><section className="flex flex-col gap-6"><h3 className="flex items-center gap-2 text-sm font-semibold text-heading-text"><HugeiconsIcon icon={Shield01Icon} className="size-4" strokeWidth={1.5} color="currentColor" />Account Actions</h3><div className="flex flex-wrap gap-3"><Button asChild variant="secondary" size="sm"><Link href="/dashboard/data"><HugeiconsIcon icon={DatabaseIcon} className="size-4" strokeWidth={1.5} color="currentColor" />Data Management</Link></Button><Button variant="secondary" size="sm" className="gap-2" onClick={onSignOutPrompt}><HugeiconsIcon icon={Logout01Icon} className="size-4" strokeWidth={1.5} color="currentColor" />Sign Out</Button></div><Separator /><SettingsDangerZone><p className="text-xs text-muted-foreground/85 text-balance">Permanently delete your account and all associated trading data, files, and settings. This action is irreversible.</p><Button variant="secondary" size="sm" className="w-fit gap-2 border-destructive/30 hover:border-destructive hover:bg-destructive/10" onClick={onDelete}><HugeiconsIcon icon={Delete02Icon} className="size-4" strokeWidth={1.5} color="currentColor" />Delete Account</Button></SettingsDangerZone></section></section>
}
