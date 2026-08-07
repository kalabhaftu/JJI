'use client'

import type { Dispatch, SetStateAction } from 'react'
import {
  Activity,
  BellRing,
  Bot,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight as CaretRight,
  Clock,
  Eye,
  Globe,
  Laptop,
  LayoutGrid,
  Moon,
  Palette,
  Sparkles,
  Sun,
  SunMoon,
  Target,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { formatBreakevenBand } from '@/lib/metrics/outcome'
import { SettingRow } from './setting-row'
import { defaultAiSettings, timezones } from './settings-config'
import type { SettingsProfileData } from './settings-types'

type Theme = 'light' | 'dark' | 'system' | 'black'
type AccentPack = 'classic' | 'reports' | 'violet' | 'slate'
type WidgetStyle = 'default' | 'glass'
type ChartStyle = 'smooth' | 'sharp'

type SettingsPreferencesSectionProps = {
  theme: Theme
  accentPack: AccentPack
  widgetStyle: WidgetStyle
  chartStyle: ChartStyle
  onThemeChange: (value: string) => void
  onAccentChange: (value: AccentPack) => void
  onWidgetStyleChange: (value: WidgetStyle) => void
  onChartStyleChange: (value: ChartStyle) => void
  timezone: string
  onTimezoneChange: (value: string) => void
  use24HourFormat: boolean
  setUse24HourFormat: (value: boolean) => void
  profileData: SettingsProfileData
  breakEvenDraft: string
  setBreakEvenDraft: Dispatch<SetStateAction<string>>
  isUpdatingBreakEven: boolean
  onBreakEvenSave: () => void
  onPnlDisplayModeChange: (value: string) => void
  privacyMode: boolean
  onPrivacyModeToggle: (checked: boolean) => void
  onAutoAdjustChange: (checked: boolean) => void
  isLoadingProfile: boolean
  isUpdatingAiSettings: boolean
  onAiSettingsChange: (key: keyof typeof defaultAiSettings, checked: boolean) => void
}

export function SettingsPreferencesSection({
  theme,
  accentPack,
  widgetStyle,
  chartStyle,
  onThemeChange: handleThemeChange,
  onAccentChange: handleAccentChange,
  onWidgetStyleChange: handleWidgetStyleChange,
  onChartStyleChange: handleChartStyleChange,
  timezone,
  onTimezoneChange: handleTimezoneChange,
  use24HourFormat,
  setUse24HourFormat,
  profileData,
  breakEvenDraft,
  setBreakEvenDraft,
  isUpdatingBreakEven,
  onBreakEvenSave: handleBreakEvenThresholdSave,
  onPnlDisplayModeChange: handlePnlDisplayModeChange,
  privacyMode,
  onPrivacyModeToggle: handlePrivacyModeToggle,
  onAutoAdjustChange: handleAutoAdjustChange,
  isLoadingProfile,
  isUpdatingAiSettings,
  onAiSettingsChange: handleAiSettingsChange,
}: SettingsPreferencesSectionProps) {
  const themeInfo = theme === 'dark'
    ? { icon: Moon, label: 'Dark' }
    : theme === 'light'
      ? { icon: Sun, label: 'Light' }
      : theme === 'black'
        ? { icon: Moon, label: 'Black' }
        : { icon: Laptop, label: 'System' }

  return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-heading-text">Preferences</h2>
          <p className="text-xs text-muted-foreground/85">Customize your platform experience and AI settings</p>
        </div>

        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-1" data-tour="settings-card-preferences">
          {                     }
          <SettingRow
            icon={SunMoon}
            label="Theme"
            description="Choose your preferred color scheme"
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2 min-w-[110px] h-8 text-xs" data-tour="theme-switcher-container">
                    <themeInfo.icon className="h-3.5 w-3.5" />
                    {themeInfo.label}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleThemeChange("dark")}>
                    <Moon className="mr-2 h-3.5 w-3.5" />
                    Dark
                    {theme === 'dark' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleThemeChange("light")}>
                    <Sun className="mr-2 h-3.5 w-3.5" />
                    Light
                    {theme === 'light' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleThemeChange("system")}>
                    <Laptop className="mr-2 h-3.5 w-3.5" />
                    System
                    {theme === 'system' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleThemeChange("black")}>
                    <Moon className="mr-2 h-3.5 w-3.5" />
                    Black
                    {theme === 'black' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {                            }
          <SettingRow
            icon={Palette}
            label="Color Accent"
            description={accentPack === 'reports' ? 'Forest' : accentPack === 'violet' ? 'Orchid' : accentPack === 'slate' ? 'Graphite' : 'Classic'}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2 min-w-[155px] h-8 text-xs justify-between">
                    <span className="flex items-center gap-2">
                      <span className="flex gap-1 shrink-0">
                        <span className={cn("w-2 h-2 rounded-full",
                          accentPack === 'reports' ? 'bg-[#83b885]' : accentPack === 'violet' ? 'bg-[#a78bfa]' : accentPack === 'slate' ? 'bg-[#f8fafc]' : 'bg-[#10b981]'
                        )} />
                        <span className={cn("w-2 h-2 rounded-full",
                          accentPack === 'reports' ? 'bg-[#ce6730]' : accentPack === 'violet' ? 'bg-[#f472b6]' : accentPack === 'slate' ? 'bg-[#64748b]' : 'bg-[#ef4444]'
                        )} />
                      </span>
                      {accentPack === 'reports' ? 'Forest' : accentPack === 'violet' ? 'Orchid' : accentPack === 'slate' ? 'Graphite' : 'Classic'}
                    </span>
                    <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleAccentChange('classic')}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-[#10b981]" />
                        <div className="w-3 h-3 rounded-full bg-[#ef4444]" />
                      </div>
                      Classic
                    </div>
                    {accentPack === 'classic' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAccentChange('reports')}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-[#83b885]" />
                        <div className="w-3 h-3 rounded-full bg-[#ce6730]" />
                      </div>
                      Forest
                    </div>
                    {accentPack === 'reports' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAccentChange('violet')}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-[#a78bfa]" />
                        <div className="w-3 h-3 rounded-full bg-[#f472b6]" />
                      </div>
                      Orchid
                    </div>
                    {accentPack === 'violet' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleAccentChange('slate')}>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1 shrink-0">
                        <div className="w-3 h-3 rounded-full bg-[#f8fafc]" />
                        <div className="w-3 h-3 rounded-full bg-[#64748b]" />
                      </div>
                      Graphite
                    </div>
                    {accentPack === 'slate' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {                        }
          <SettingRow
            icon={Globe}
            label="Timezone"
            description={timezone.replace('_', ' ')}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2 h-8 text-xs">
                    Change
                    <CaretRight className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <ScrollArea className="h-[200px]">
                    <DropdownMenuRadioGroup value={timezone} onValueChange={handleTimezoneChange}>
                      {timezones.map((tz) => (
                        <DropdownMenuRadioItem key={tz} value={tz} className="text-xs">
                          {tz.replace('_', ' ')}
                        </DropdownMenuRadioItem>
                      ))}
                    </DropdownMenuRadioGroup>
                  </ScrollArea>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {                 }
          <SettingRow
            icon={Clock}
            label="Time Format"
            description={use24HourFormat ? "24-hour" : "12-hour"}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2 h-8 text-xs">
                    Change
                    <CaretRight className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup value={use24HourFormat ? "24h" : "12h"} onValueChange={(v) => {
                    setUse24HourFormat(v === "24h")
                    toast.success("Time format updated", {
                      description: `Time format changed to ${v === "24h" ? "24-hour" : "12-hour"}.`,
                      duration: 2000
                    })
                  }}>
                    <DropdownMenuRadioItem value="24h" className="text-xs">24-hour (14:30)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="12h" className="text-xs">12-hour (2:30 PM)</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {                     }
          <SettingRow
            icon={Target}
            label="Break-even threshold"
            description={`Breakeven band: ${formatBreakevenBand(profileData.breakEvenThreshold)}. Counted as win above +$${profileData.breakEvenThreshold}, loss below -$${profileData.breakEvenThreshold}.`}
            action={
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={breakEvenDraft}
                  onChange={(e) => setBreakEvenDraft(e.target.value)}
                  className="h-8 w-24 text-xs"
                />
                <Button
                  size="sm"
                  className="h-8 text-xs"
                  onClick={handleBreakEvenThresholdSave}
                  disabled={isUpdatingBreakEven}
                >
                  {isUpdatingBreakEven ? 'Saving...' : 'Save'}
                </Button>
              </div>
            }
          />

          <Separator className="my-1 border-border/30" />

          {                 }
          <SettingRow
            icon={TrendingUp}
            label="P&L display"
            description={profileData.pnlDisplayMode === 'gross'
              ? 'Show gross P&L before commissions and swap on dashboard/report money surfaces.'
              : 'Show net P&L after commissions and swap on dashboard/report money surfaces.'}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2 h-8 text-xs">
                    {profileData.pnlDisplayMode === 'gross' ? 'Gross' : 'Net'}
                    <CaretRight className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuRadioGroup
                    value={profileData.pnlDisplayMode}
                    onValueChange={handlePnlDisplayModeChange}
                  >
                    <DropdownMenuRadioItem value="net" className="text-xs">Net (after fees)</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="gross" className="text-xs">Gross (before fees)</DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {                  }
          <SettingRow
            icon={LayoutGrid}
            label="Widget Style"
            description={widgetStyle === 'glass' ? 'Glassmorphism with distinct borders' : 'Standard muted panel style'}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2 min-w-[120px] h-8 text-xs">
                    {widgetStyle === 'glass' ? 'Glassmorphism' : 'Standard'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleWidgetStyleChange('default')}>
                    Standard
                    {widgetStyle === 'default' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleWidgetStyleChange('glass')}>
                    Glassmorphism
                    {widgetStyle === 'glass' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {                 }
          <SettingRow
            icon={Activity}
            label="Chart Edge Style"
            description={chartStyle === 'sharp' ? 'Sharp angular lines following your color accent' : 'Smooth curved lines following your color accent'}
            action={
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="secondary" size="sm" className="gap-2 min-w-[120px] h-8 text-xs">
                    {chartStyle === 'sharp' ? 'Sharp' : 'Smooth'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleChartStyleChange('smooth')}>
                    Smooth
                    {chartStyle === 'smooth' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleChartStyleChange('sharp')}>
                    Sharp
                    {chartStyle === 'sharp' && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            }
          />

          <Separator className="my-1 border-border/30" />

          {                  }
          <SettingRow
            icon={Eye}
            label="Privacy Mode"
            description="Hide monetary balances across the dashboard"
            action={
              <Switch
                checked={privacyMode}
                onCheckedChange={handlePrivacyModeToggle}
              />
            }
          />

          <Separator className="my-1 border-border/30" />

          {                      }
          <SettingRow
            icon={Calendar}
            label="Auto-adjust Account Date"
            description="Automatically set account start date to your first trade"
            action={
              <Button
                variant={profileData.autoAdjustAccountDate ? "primary" : "secondary"}
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleAutoAdjustChange(!profileData.autoAdjustAccountDate)}
              >
                {profileData.autoAdjustAccountDate ? "Enabled" : "Disabled"}
              </Button>
            }
          />
        </div>

        {                    }
        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
            <Bot className="h-4 w-4" />
            AI Preferences
          </h3>

          <div className="space-y-1">
            <SettingRow
              icon={Sparkles}
              label="Weekly AI Performance Reviews"
              description="Get an AI-generated weekly report card every weekend"
              action={
                <Switch
                  checked={profileData.aiSettings.autoGenerateInsights}
                  onCheckedChange={(checked) => handleAiSettingsChange('autoGenerateInsights', checked)}
                  disabled={isLoadingProfile || isUpdatingAiSettings}
                />
              }
            />

            <Separator className="my-1 border-border/30" />

            <SettingRow
              icon={BellRing}
              label="AI insights in notifications"
              description="Create a notification with a summary when you run an AI analysis"
              action={
                <Switch
                  checked={profileData.aiSettings.includeAiInsightsInNotifications}
                  onCheckedChange={(checked) => handleAiSettingsChange('includeAiInsightsInNotifications', checked)}
                  disabled={isLoadingProfile || isUpdatingAiSettings}
                />
              }
            />
          </div>
        </div>
      </div>
  )
}
