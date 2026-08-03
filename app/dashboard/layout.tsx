import { DataProvider } from "@/context/data-provider";
import { TemplateProvider } from "@/context/template-provider";
import { TagsProvider } from "@/context/tags-provider";
import Modals from "@/components/modals";
import { ReactNode, Suspense } from "react";
import { redirect } from "next/navigation";
import { SidebarLayout } from "./components/sidebar-layout";
import { MobileBottomNav } from "@/components/ui/mobile-nav";
import { QuickAddFAB } from "@/components/quick-add-fab";
import { getInitBootstrapData } from "@/server/init-bootstrap";
import { getSiteUiSettings } from "@/server/site-ui-settings";

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
export default async function RootLayout({ children }: { children: ReactNode }) {
  const [initialBootstrapData, siteUiSettings] = await Promise.all([
    getInitBootstrapData(),
    getSiteUiSettings(),
  ])

  if (initialBootstrapData.isAuthenticated && initialBootstrapData.user?.id) {
    const access = initialBootstrapData.subscriptionAccess
    if (!access) redirect('/login')
    if (!access.hasAccess && access.redirectTo) {
      redirect(access.redirectTo as any)
    }

  } else if (!initialBootstrapData.isAuthenticated) {
    redirect("/login")
  }

  return (
    <AuthenticatedProviders>
      <DataProvider initialBootstrapData={initialBootstrapData}>
        <SyncContextWrapper>
          <TourWrapper>
                <TagsProvider>
                  <TemplateProvider initialActiveTemplate={initialBootstrapData.activeTemplateShell}>
                      <div className="min-h-screen flex flex-col">
                        <Suspense fallback={<div className="flex flex-1" />}>
                          <SidebarLayout siteUiSettings={siteUiSettings}>
                            {children}
                          </SidebarLayout>
                        </Suspense>
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
    </AuthenticatedProviders>
  );
}
