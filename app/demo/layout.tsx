import { DataProvider } from "@/context/data-provider";
import { TemplateProvider } from "@/context/template-provider";
import { TagsProvider } from "@/context/tags-provider";
import Modals from "@/components/modals";
import { ReactElement, Suspense } from "react";
import { SidebarLayout } from "../dashboard/components/sidebar-layout";
import { MobileBottomNav } from "@/components/ui/mobile-nav";
import { QuickAddFAB } from "@/components/quick-add-fab";

import { TourProvider } from "@/context/tour-context";
import { DemoNetworkInterceptor } from "./components/demo-network-interceptor";
import { TradovateSyncContextProvider } from "@/context/tradovate-sync-context";
import { DxFeedSyncContextProvider } from "@/context/dxfeed-sync-context";
import { RithmicSyncContextProvider } from "@/context/rithmic-sync-context";
import { ClientDynamicComponents } from "../dashboard/components/client-dynamic-components";

export default async function DemoLayout({ children }: { children: ReactElement }) {
  const siteUiSettings = { showDonateButton: true, showFeedbackButton: true }

  return (
    <>
    <DemoNetworkInterceptor />
      <DataProvider isDemoMode={true}>
        <TradovateSyncContextProvider disabled>
          <DxFeedSyncContextProvider disabled>
            <RithmicSyncContextProvider disabled>
              <TourProvider>
                <TagsProvider>
                  <TemplateProvider initialActiveTemplate={null}>
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
                      </div>
                  </TemplateProvider>
                </TagsProvider>
              </TourProvider>
            </RithmicSyncContextProvider>
          </DxFeedSyncContextProvider>
        </TradovateSyncContextProvider>
      </DataProvider>
    </>
  );
}
