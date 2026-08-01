'use client'
import React, {
  createContext,
  useState,
  useContext,
  useEffect,
  useCallback,
  useMemo
} from 'react';
import { useQueryClient } from '@tanstack/react-query';

import type { DashboardTemplateType as DashboardLayoutType } from '@/lib/db/schema';

import { apiRequest } from '@/lib/api/client';
import { createClient } from '@/lib/supabase';
import { signOut } from '@/server/auth/providers';
import { useUserStore } from '@/store/user-store';
import { useAccountFilterSettings } from '@/hooks/use-account-filter-settings';
import { useFilteredTrades } from '@/hooks/use-filtered-trades';
import { useDataProviderRealtime } from '@/hooks/use-data-provider-realtime';
import {
  useDataProviderFilterState,
} from '@/hooks/use-data-provider-filter-state';
import { defaultLayouts } from '@/lib/dashboard/default-layouts';
import { useDataProviderTradeMutations } from '@/hooks/use-data-provider-trade-mutations';
import { usePropFirmStore } from '@/hooks/use-prop-firm-dashboard-widget-data';
import { EMPTY_CALENDAR_DATA, EMPTY_STATISTICS } from './data-provider/types';
import type { DataContextType } from './data-provider/types';

export type { Account } from './data-provider/types';
import { useDataProviderAccountActions } from '@/hooks/use-data-provider-account-actions';
import { reportClientError } from '@/lib/observability/report-error';


const DataContext = createContext<DataContextType | undefined>(undefined);

function useIsMobileDetection() {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(max-width: 768px)').matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mobileQuery = window.matchMedia('(max-width: 768px)');
    const checkMobile = (e: MediaQueryListEvent | MediaQueryList) => setIsMobile(e.matches);

    // Check immediately
    checkMobile(mobileQuery);

    // Add listener for changes
    mobileQuery.addEventListener('change', checkMobile);
    return () => mobileQuery.removeEventListener('change', checkMobile);
  }, []);

  return isMobile;
}

import { calculateAccountBalance as calcBalance } from '@/lib/utils/balance-calculator';

const supabase = createClient()

const normalizeSelection = (selection: string[]) =>
  Array.from(new Set(selection)).sort()

const selectionsMatch = (a: string[], b: string[]) => {
  if (a.length !== b.length) return false
  const normalizedA = normalizeSelection(a)
  const normalizedB = normalizeSelection(b)
  return normalizedA.every((value, index) => value === normalizedB[index])
}

export const DataProvider: React.FC<{
  children: React.ReactNode;
  isDemoMode?: boolean;
  initialBootstrapData?: {
    isAuthenticated: boolean
    user: any | null
    accounts: any[]
  }
}> = ({ children, initialBootstrapData, isDemoMode = false }) => {
  const isMobile = useIsMobileDetection();

  // Get store values
  const user = useUserStore(state => state.user);
  const setUser = useUserStore(state => state.setUser);

  const setAccounts = useUserStore(state => state.setAccounts);
  const setDashboardLayout = useUserStore(state => state.setDashboardLayout);
  const supabaseUser = useUserStore(state => state.supabaseUser);
  const timezone = useUserStore(state => state.timezone);
  const accounts = useUserStore(state => state.accounts);
  const setSupabaseUser = useUserStore(state => state.setSupabaseUser);

  const dashboardLayout = useUserStore(state => state.dashboardLayout);
  const locale = 'en' // Fixed to English since we removed i18n
  const isLoading = useUserStore(state => state.isLoading)
  const setIsLoading = useUserStore(state => state.setIsLoading)

  // Remove unused states that caused dependency issues

  const { settings: accountFilterSettings, isLoading: isLoadingAccountFilterSettings, updateSettings: updateAccountFilterSettings } = useAccountFilterSettings()

  const {
    instruments,
    setInstruments,
    accountNumbers,
    setAccountNumbers,
    dateRange,
    setDateRange,
    pnlRange,
    setPnlRange,
    timeRange,
    setTimeRange,
    weekdayFilter,
    setWeekdayFilter,
    hourFilter,
    setHourFilter,
    tradeFilters,
  } = useDataProviderFilterState(timezone)

  const [isFirstConnection, setIsFirstConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize account filter from saved settings (CLIENT-SIDE ONLY)
  const selectionInitializedRef = React.useRef(false)
  const lastSyncedSelectionRef = React.useRef<string>('')

  // Initialize account filter from saved settings only (NO AUTO-SELECTION)
  // User must explicitly select accounts
  useEffect(() => {
    if (!accounts || accounts.length === 0) {
      return
    }

    // ONLY load from saved settings - no auto-selection
    const savedSelection = accountFilterSettings?.selectedPhaseAccountIds || []
    const savedSignature = JSON.stringify(normalizeSelection(savedSelection))

    if (!selectionInitializedRef.current) {
      if (savedSelection.length > 0) {
        setAccountNumbers(savedSelection)
        selectionInitializedRef.current = true
        lastSyncedSelectionRef.current = savedSignature

        try {
          localStorage.setItem(
            'settings-cache',
            JSON.stringify({
              selectedPhaseAccountIds: savedSelection,
            })
          )
        } catch (error) {
          // Ignore storage errors
        }
        return
      }

      // Check localStorage cache as fallback
      let cachedSelection: string[] | null = null
      try {
        const cached = localStorage.getItem('settings-cache')
        if (cached) {
          const settings = JSON.parse(cached)
          cachedSelection = settings.selectedPhaseAccountIds || null
        }
      } catch (error) {
        // Ignore parsing errors
      }

      if (cachedSelection && cachedSelection.length > 0) {
        setAccountNumbers(cachedSelection)
        selectionInitializedRef.current = true
        lastSyncedSelectionRef.current = JSON.stringify(normalizeSelection(cachedSelection))
        return
      }

      // NO SAVED SELECTION - leave accountNumbers empty
      // This will show "All Accounts" in the navbar and show all data
      // User must explicitly select accounts via the filter dialog
      selectionInitializedRef.current = true
      lastSyncedSelectionRef.current = ''
      return
    }

    // Sync updates from server settings (e.g., another tab saved settings)
    if (
      savedSelection.length > 0 &&
      savedSignature !== lastSyncedSelectionRef.current &&
      !selectionsMatch(savedSelection, accountNumbers)
    ) {
      setAccountNumbers(savedSelection)
      lastSyncedSelectionRef.current = savedSignature
    }
  }, [accounts, accountFilterSettings, accountNumbers, setAccountNumbers])

  // Track active data loading to prevent concurrent calls - MOVED TO useRef FOR PERSISTENCE
  const activeLoadPromiseRef = React.useRef<Promise<void> | null>(null)
  const hasLoadedDataRef = React.useRef(false)

  // HYDRATE FROM SERVER BOOTSTRAP (targeted SSR path)
  useEffect(() => {
    if (isDemoMode) return
    
    if (!initialBootstrapData?.isAuthenticated) return
    if (hasLoadedDataRef.current) return

    hasLoadedDataRef.current = true

    const { user: userData, accounts: rawAccounts } = initialBootstrapData

    setUser(userData as any)
    setIsFirstConnection(!!userData?.isFirstConnection)

    const accountsWithBalance = (rawAccounts || []).map((account: any) => ({
      ...account,
      balanceToDate: calcBalance(account, [], [], {
        excludeFailedAccounts: false,
        includePayouts: true
      })
    }))

    setAccounts(accountsWithBalance)

    if (userData?.accountFilterSettings) {
      try {
        const hasPendingChanges = localStorage.getItem('settings-pending')
        if (!hasPendingChanges) {
          const settings = JSON.parse(userData.accountFilterSettings)
          localStorage.setItem('settings-cache', JSON.stringify(settings))
        }
      } catch {
        localStorage.removeItem('settings-cache')
      }
    }

    setIsLoading(false)
  }, [initialBootstrapData, setAccounts, setIsLoading, setUser, isDemoMode])

  const loadData = useCallback(async () => {
    if (activeLoadPromiseRef.current) return activeLoadPromiseRef.current

    
    activeLoadPromiseRef.current = (async () => {
      try {
        setIsLoading(true);

        if (isDemoMode) {
          const mockData = await import('@/lib/demo/mock-data')
          setUser(mockData.MOCK_USER_PROFILE as any)
          setAccounts(mockData.MOCK_ACCOUNTS as any)
          setIsLoading(false)
          hasLoadedDataRef.current = true
          return
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          setIsLoading(false)
          hasLoadedDataRef.current = false
          return;
        }
        setSupabaseUser(user);

        if (!dashboardLayout) {
          const freshDefaultLayout = { 
            ...defaultLayouts,
            id: `default-${user.id}`,
            userId: user.id,
            createdAt: new Date(),
            updatedAt: new Date()
          }
          try {
            const cachedLayout = localStorage.getItem(`dashboard-layout-${user.id}`)
            if (cachedLayout) {
              const parsedLayout = JSON.parse(cachedLayout)
              if (parsedLayout.desktop && parsedLayout.mobile) {
                setDashboardLayout(parsedLayout)
              } else {
                setDashboardLayout(freshDefaultLayout)
                localStorage.setItem(`dashboard-layout-${user.id}`, JSON.stringify(freshDefaultLayout))
              }
            } else {
              setDashboardLayout(freshDefaultLayout)
              localStorage.setItem(`dashboard-layout-${user.id}`, JSON.stringify(freshDefaultLayout))
            }
          } catch (error) {
            setDashboardLayout(freshDefaultLayout)
          }
        }

        // Step 2: Fetch initial data from v1 init endpoint (NO trades - those come via React Query)
        // If SSR bootstrap already provided authenticated data, skip this duplicate DB-heavy fetch.
        const initData = initialBootstrapData?.isAuthenticated
          ? initialBootstrapData
          : await (async () => {
              const initResponse = await fetch('/api/v1/init', {
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
              })

              if (!initResponse.ok) throw new Error('Failed to fetch initial data')
              const payload = await initResponse.json()
              return payload.data
            })()
        
        if (!initData.isAuthenticated) {
          await signOut().catch(() => undefined)
          setIsLoading(false)
          hasLoadedDataRef.current = false
          return;
        }

        const { user: userData, accounts: rawAccounts } = initData

        setUser(userData);
        setIsFirstConnection(userData?.isFirstConnection || false)

        // Persist account filter settings
        if (userData?.accountFilterSettings) {
          try {
            const hasPendingChanges = localStorage.getItem('settings-pending')
            if (!hasPendingChanges) {
              const settings = JSON.parse(userData.accountFilterSettings)
              localStorage.setItem('settings-cache', JSON.stringify(settings))
            }
          } catch {
            localStorage.removeItem('settings-cache')
          }
        }

        // Calculate balanceToDate for accounts (without trades, uses trade count from API)
        const accountsWithBalance = (rawAccounts || []).map((account: any) => ({
          ...account,
          balanceToDate: calcBalance(account, [], [], {
            excludeFailedAccounts: false,
            includePayouts: true
          })
        }));
        
        setAccounts(accountsWithBalance);

      } catch (error) {
        if (error instanceof Error && (
          error.message === 'NEXT_REDIRECT' || 
          error.message.includes('NEXT_REDIRECT') ||
          ('digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))
        )) {
          throw error;
        }
        if (error instanceof Error && (
          error.message.includes('User not authenticated') ||
          error.message.includes('User not found') ||
          error.message.includes('Unauthorized')
        )) {
          await signOut().catch(() => undefined)
          return;
        }
        hasLoadedDataRef.current = false;
      } finally {
        setIsLoading(false);
        setTimeout(() => { activeLoadPromiseRef.current = null; }, 0);
      }
    })();

    return activeLoadPromiseRef.current
  }, [dashboardLayout, initialBootstrapData, setAccounts, setDashboardLayout, setIsLoading, setSupabaseUser, setUser, isDemoMode]);

  useEffect(() => {
    if (isDemoMode) {
      if (hasLoadedDataRef.current) return;
      setIsLoading(true);
      hasLoadedDataRef.current = true;
      loadData();
      return;
    }

    // CRITICAL FIX: Only run on initial mount when supabaseUser is first set
    if (!supabaseUser) {
      return
    }
    
    // CRITICAL: Check and set flag IMMEDIATELY to prevent duplicate calls
    if (hasLoadedDataRef.current) {
      return
    }
    
    setIsLoading(true);
    hasLoadedDataRef.current = true
    
    let mounted = true;

    const loadDataIfMounted = async () => {
      if (!mounted) return;
      
      try {
        await loadData()
      } catch (error) {
        // Handle Next.js redirect errors (these are normal and expected)
        if (error instanceof Error && (
          error.message === 'NEXT_REDIRECT' || 
          error.message.includes('NEXT_REDIRECT') ||
          ('digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))
        )) {
          // Let the redirect proceed - these are handled by Next.js router
          throw error;
        }

        // Handle authentication errors
        if (error instanceof Error && (
          error.message.includes('User not authenticated') ||
          error.message.includes('User not found') ||
          error.message.includes('Unauthorized')
        )) {
          return;
        }
        
        // Silent fail to prevent unhandled promise rejections
        
        // Set error state to inform user
        reportClientError(error, { operation: 'load-dashboard-data', route: '/dashboard' })
        setError('Failed to load data. Please refresh the page.');
        setIsLoading(false);
      }
    };

    loadDataIfMounted();

    return () => {
      mounted = false;
    };
  }, [supabaseUser, loadData, setIsLoading, isDemoMode]); // ONLY depend on supabaseUser, run once when it's set

  const queryClient = useQueryClient()
  
  // Keep the table feed paginated. Analytics use a separate metrics-only response
  // so the dashboard does not ship the full calculation payload with every table read.
  const tableTradeFilters = useMemo(() => ({
    ...tradeFilters,
    limit: 5_000,
    includeStats: false,
    includeCalendar: false,
    includeWidgets: false,
  }), [tradeFilters])
  const metricsTradeFilters = useMemo(() => {
    const { pageLimit: _pageLimit, pageOffset: _pageOffset, ...metricBase } = tradeFilters
    return {
      ...metricBase,
      metricsOnly: true,
      limit: 100_000,
    }
  }, [tradeFilters])
  const queryEnabled = isDemoMode ? true : !!supabaseUser?.id
  const { data: serverTradeData } = useFilteredTrades(tableTradeFilters, queryEnabled, isDemoMode)
  const { data: serverMetricsData } = useFilteredTrades(metricsTradeFilters, queryEnabled, isDemoMode)

  useDataProviderRealtime({
    userId: user?.id,
    enabled: !isDemoMode && !!user?.id && !isLoading,
    queryClient,
    reloadBootstrapData: loadData,
  })

  // SUPABASE KEEP-ALIVE HEARTBEAT
  // Pings DB every 4 hours to prevent free-tier pause
  useEffect(() => {
    if (isDemoMode) return

    const FOUR_HOURS = 4 * 60 * 60 * 1000

    const ping = () => {
      if (document.visibilityState === 'visible') {
        void fetch('/api/health/ping').catch(() => undefined)
      }
    }

    // Defer initial ping by 10s - avoids adding to the connection burst on dashboard load
    const initialPingTimeout = setTimeout(ping, 10_000)

    const intervalId = setInterval(ping, FOUR_HOURS)

    // Also ping when tab becomes visible after being hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ping()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(initialPingTimeout)
      clearInterval(intervalId)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isDemoMode])

  const refreshTrades = useCallback(async () => {
    if (!user?.id) return
    setIsLoading(true)
    
    try {
      localStorage.removeItem('last-refresh-timestamp')
      
      hasLoadedDataRef.current = false
      activeLoadPromiseRef.current = null
      
      usePropFirmStore.getState().clearCache()
      
      await queryClient.invalidateQueries({ queryKey: ['v1'] })
      
      await new Promise(resolve => setTimeout(resolve, 200))
      await loadData()
    } catch (error) {
      if (error instanceof Error && (
        error.message === 'NEXT_REDIRECT' || 
        error.message.includes('NEXT_REDIRECT') ||
        ('digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))
      )) {
        setIsLoading(false);
        throw error;
      }
      if (error instanceof Error && (
        error.message.includes('User not authenticated') ||
        error.message.includes('User not found') ||
        error.message.includes('Unauthorized')
      )) {
        setIsLoading(false);
        return;
      }
      setIsLoading(false)
    } finally {
      setTimeout(() => { setIsLoading(false) }, 200)
    }
  }, [user?.id, loadData, setIsLoading, locale, queryClient])

  // Expose refreshAllData as an alias for refreshTrades (it refreshes everything including accounts)
  const refreshAllData = refreshTrades

  // Server-owned trade feed. No client-side trade-store fallback or analytics.
  const formattedTrades = useMemo(() => serverTradeData?.trades ?? [], [serverTradeData?.trades]);

  const statistics = useMemo(() => {
    // Use server-computed statistics when available
    if (serverMetricsData?.statistics) return serverMetricsData.statistics;
    return EMPTY_STATISTICS;
  }, [serverMetricsData?.statistics]);

  const calendarData = useMemo(() => {
    // Use server-computed calendar data when available
    if (serverMetricsData?.calendarData) return serverMetricsData.calendarData;
    return EMPTY_CALENDAR_DATA;
  }, [serverMetricsData?.calendarData]);

  const isPlusUser = () => {
    return true; // All users now have full access
  };


  const { saveAccount, savePayout, deleteAccount, deletePayout } = useDataProviderAccountActions({
    userId: user?.id,
    accounts,
    setAccounts,
  })

  const changeIsFirstConnection = useCallback(async (isFirstConnection: boolean) => {
    if (!user?.id) return
    setIsFirstConnection(isFirstConnection)
    await apiRequest('/api/v1/settings/onboarding', {
      method: 'PATCH',
      body: JSON.stringify({ isFirstConnection }),
    })
  }, [user?.id, setIsFirstConnection])

  const { updateTrades, groupTrades, ungroupTrades, appendTagsToTrades } = useDataProviderTradeMutations({
    userId: user?.id,
    queryClient,
  })

  const saveDashboardLayout = useCallback(async (layout: DashboardLayoutType) => {
    if (!user?.id) return
    setDashboardLayout(layout)
    // Update localStorage to keep cache fresh for next visit
    try {
      localStorage.setItem(`dashboard-layout-${user.id}`, JSON.stringify(layout))
    } catch (error) {
      // Ignore localStorage errors
    }
  }, [user?.id, setDashboardLayout])

  const contextValue: DataContextType = {
    isDemoMode,
    isPlusUser,
    isLoading,
    isLoadingAccountFilterSettings,
    accountFilterSettings,
    updateAccountFilterSettings,
    isMobile,
    refreshTrades,
    refreshAllData,
    changeIsFirstConnection,
    isFirstConnection,
    setIsFirstConnection,
    error,
    setError,

    formattedTrades,
    instruments,
    setInstruments,
    accountNumbers,
    setAccountNumbers,
    dateRange,
    setDateRange,
    pnlRange,
    setPnlRange,

    // Time range related
    timeRange,
    setTimeRange,

    // Weekday filter related
    weekdayFilter,
    setWeekdayFilter,

    // Hour filter related
    hourFilter,
    setHourFilter,

    // Statistics, calendar, and widget data
    statistics,
    calendarData,
    widgetData: serverMetricsData?.widgets ?? null,

    // Accounts
    accounts,

    // Mutations

    updateTrades,
    appendTagsToTrades,
    groupTrades,
    ungroupTrades,

    // Accounts
    deleteAccount,
    saveAccount,

    deletePayout,
    savePayout,

    // Dashboard layout
    saveDashboardLayout,
  };

  return (
    <DataContext.Provider value={contextValue}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
