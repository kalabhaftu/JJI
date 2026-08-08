import { DataProvider } from "@/context/data-provider";
import { TemplateProvider } from "@/context/template-provider";
import { TagsProvider } from "@/context/tags-provider";
import Modals from "@/components/modals";
import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { SidebarLayout } from "./components/sidebar-layout";
import { MobileBottomNav } from "@/components/ui/mobile-nav";
import { QuickAddFAB } from "@/components/quick-add-fab";
import { DashboardBootstrapUnavailableError, getDashboardAccess, getDashboardBootstrapData, type DashboardAccessResult } from "@/server/init-bootstrap";
import { getSiteUiSettings } from "@/server/site-ui-settings";
import { DashboardLoadingSkeleton } from "@/components/ui/dashboard-skeleton";

import { SyncContextWrapper } from "./components/sync-context-wrapper";
import { TourWrapper } from "./components/tour-wrapper";
import { ClientDynamicComponents } from "./components/client-dynamic-components";
import { DeploymentMonitor } from "@/components/deployment-monitor";
import { AppBanner } from "@/components/app-banner";
import { OfflineIndicator } from "@/components/offline-indicator";
import { AuthenticatedProviders } from "@/components/authenticated-providers";

import type { Metadata } from "next";

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
  },
}
async function DashboardLayoutContent({
  children,
  access,
  siteUiSettings,
}: {
  children: ReactNode
  access: Extract<DashboardAccessResult, { status: 'ready' }>
  siteUiSettings: ReturnType<typeof getSiteUiSettings>
}) {
  const [initialBootstrapData, resolvedSiteUiSettings] = await Promise.all([
    getDashboardBootstrapData(access),
    siteUiSettings,
  ])

  return (
    <DataProvider initialBootstrapData={initialBootstrapData}>
      <SyncContextWrapper>
        <TourWrapper>
          <TagsProvider>
            <TemplateProvider initialActiveTemplate={initialBootstrapData.activeTemplateShell}>
              <div className="min-h-screen flex flex-col">
                <SidebarLayout siteUiSettings={resolvedSiteUiSettings}>
                  {children}
                </SidebarLayout>
                <Modals />
                <MobileBottomNav />
                <QuickAddFAB />
                <ClientDynamicComponents />
                <DeploymentMonitor />
                <AppBanner />
                <OfflineIndicator />
              </div>
            </TemplateProvider>
          </TagsProvider>
        </TourWrapper>
      </SyncContextWrapper>
    </DataProvider>
  )
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const access = await getDashboardAccess()

  if (access.status === 'unauthenticated') {
    redirect('/login?next=/dashboard')
  }
  if (access.status === 'unavailable') {
    throw new DashboardBootstrapUnavailableError()
  }
  if (!access.subscriptionAccess.hasAccess && access.subscriptionAccess.redirectTo) {
    redirect(access.subscriptionAccess.redirectTo as any)
  }

  return (
    <AuthenticatedProviders>
      <Suspense fallback={<DashboardLoadingSkeleton />}>
        <DashboardLayoutContent access={access} siteUiSettings={getSiteUiSettings()}>
          {children}
        </DashboardLayoutContent>
      </Suspense>
    </AuthenticatedProviders>
  )
}
