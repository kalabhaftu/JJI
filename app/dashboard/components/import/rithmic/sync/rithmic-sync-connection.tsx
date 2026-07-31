'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, ArrowLeft } from 'lucide-react'
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { toast } from 'sonner'
import { RithmicSyncFeedback } from './rithmic-sync-progress'
import { useRithmicSyncStore } from '@/store/rithmic-sync-store'
import { saveRithmicData, getRithmicData, clearRithmicData, generateCredentialId, getAllRithmicData, RithmicCredentialSet } from '@/lib/rithmic-storage'
import { RithmicCredentialsManager } from './rithmic-credentials-manager'
import Image from 'next/image'
import { useUserStore } from '@/store/user-store'
import { setRithmicSynchronization } from './actions'
import { useRithmicSyncContext } from '@/context/rithmic-sync-context'
import { logger } from '@/lib/logger';

interface RithmicCredentials {
  username: string
  password: string
  server_type: string
  location: string
  userId: string
}

interface RithmicSyncConnectionProps {
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
}

function RithmicSyncConnection({ setIsOpen }: RithmicSyncConnectionProps) {
  const user = useUserStore(state => state.user)
  const { 
    connect, 
    disconnect, 
    isConnected, 
    handleMessage,
    authenticateAndGetAccounts,
    calculateStartDate
  } = useRithmicSyncContext()
  
  const {
    selectedAccounts,
    setSelectedAccounts,
    availableAccounts,
    setAvailableAccounts,
    processingStats,
    resetProcessingState,
    step,
    setStep
  } = useRithmicSyncStore()

  const [isLoading, setIsLoading] = useState(false)
  const [shouldAutoConnect, setShouldAutoConnect] = useState(false)
  const [wsUrl, setWsUrl] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [serverConfigs, setServerConfigs] = useState<Record<string, string[]>>({})
  
  const fetchServerConfigs = useCallback(async () => {
    try {
      const isLocalhost = process.env.NEXT_PUBLIC_RITHMIC_API_URL?.includes('localhost')
      const http = isLocalhost ? window.location.protocol : 'https:'
      const response = await fetch(`${http}//${process.env.NEXT_PUBLIC_RITHMIC_API_URL}/servers`)
      const data = await response.json()

      if (data.success) {
        setServerConfigs(data.servers)
      } else {
        throw new Error(data.message)
      }
    } catch (error) {
      logger.error('Failed to fetch server configurations: ' + (error instanceof Error ? error.message : String(error)))
    }
  }, [])
  
  const [credentials, setCredentials] = useState<RithmicCredentials>({
    username: '',
    password: '',
    server_type: 'Rithmic Paper Trading',
    location: 'Chicago Area',
    userId: user?.id || ''
  })
  const [shouldSaveCredentials, setShouldSaveCredentials] = useState(true)
  const [showCredentialsManager, setShowCredentialsManager] = useState(true)
  const [currentCredentialId, setCurrentCredentialId] = useState<string | null>(null)
  const [allAccounts, setAllAccounts] = useState(true)
  const [accountSearch, setAccountSearch] = useState('')

  const isLegacyCredentialId = useCallback(
    (id: string | null) => !!id && id.startsWith('rithmic_'),
    []
  )

  const filteredAccounts = useMemo(() => {
    if (!accountSearch) return availableAccounts
    const searchLower = accountSearch.toLowerCase()
    return availableAccounts.filter(account => 
      account.account_id.toLowerCase().includes(searchLower) ||
      account.fcm_id.toLowerCase().includes(searchLower)
    )
  }, [availableAccounts, accountSearch])

  const handleConnect = useCallback(async (event: React.FormEvent, isAutoConnect: boolean = false) => {
    event.preventDefault()
    setIsLoading(true)

    if (isConnected) {
      logger.info('Disconnecting existing WebSocket connection before new connection attempt')
      disconnect()
    }

    try {
      const result = await authenticateAndGetAccounts(credentials)
      
      if (!result.success) {
        if (result.rateLimited) {
          toast.error("Rate Limit Exceeded", {
            description: "Maximum 2 login attempts per 15 minutes. Please wait 8 minutes before trying again."
          })
          return
        }
        throw new Error(result.message)
      }

      setAvailableAccounts(result.accounts)
      setToken(result.token)
      setWsUrl(result.websocket_url)
      setStep('select-accounts')
      
      handleMessage({
        type: 'log',
        level: 'info',
        message: `Retrieved ${result.accounts.length} accounts. Please select accounts and click "Start Processing"`
      })
    } catch (error: unknown) {
      if (!(error instanceof Error && error.message.includes('Rate limit exceeded'))) {
        logger.error('Connection error: ' + (error instanceof Error ? error.message : String(error)))
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      toast.error("Connection Failed", {
        description: error instanceof DOMException && error.name === 'AbortError' 
          ? "Connection timed out. Please try again."
          : errorMessage,
      })

      if (error instanceof DOMException && error.name === 'AbortError' || 
          errorMessage.includes('invalid credentials')) {
        setCredentials({
          username: '',
          password: '',
          server_type: 'Rithmic Paper Trading',
          location: 'Chicago Area',
          userId: user?.id || ''
        })
      }

      handleMessage({
        type: 'log',
        level: 'error',
        message: `Connection error: ${errorMessage}`
      })
    } finally {
      setIsLoading(false)
    }
  }, [
    credentials, 
    isConnected, 
    disconnect, 
    handleMessage, 
    user?.id,
    authenticateAndGetAccounts,
    setAvailableAccounts,
    setStep,
    setToken,
    setWsUrl,
  ])

  const handleSelectCredential = useCallback((credential: RithmicCredentialSet) => {
    setCredentials({
      ...credential.credentials,
      password: credential.credentials.password,
      userId: user?.id || ''
    })
    setSelectedAccounts(credential.selectedAccounts)
    setAllAccounts(credential.allAccounts || false)
    setCurrentCredentialId(credential.id)
    setShouldSaveCredentials(true)
    setShowCredentialsManager(false)
    setShouldAutoConnect(true)
  }, [user?.id, setSelectedAccounts])

  const handleLoginWithSyncId = useCallback((syncId: string) => {
    if (isLegacyCredentialId(syncId)) {
      toast.error("Legacy Sync ID", {
        description: "Legacy sync configurations cannot be managed here. Please recreate the connection."
      })
      return
    }

    setCurrentCredentialId(syncId)
    setShowCredentialsManager(false)
    setStep('credentials')
    setSelectedAccounts([])
    setAvailableAccounts([])
    setAllAccounts(true)
    setAccountSearch('')
    setShouldSaveCredentials(true)
    setCredentials({
      username: '',
      password: '',
      server_type: 'Rithmic Paper Trading',
      location: 'Chicago Area',
      userId: user?.id || ''
    })
  }, [
    isLegacyCredentialId,
    user?.id,
    setSelectedAccounts,
    setAvailableAccounts,
    setStep,
    setAllAccounts,
    setAccountSearch,
    setShowCredentialsManager,
    setShouldSaveCredentials
  ])

  useEffect(() => {
    if (shouldAutoConnect && credentials.username && credentials.password) {
      setShouldAutoConnect(false)
      handleConnect(new Event('submit') as any, false)
    }
  }, [shouldAutoConnect, credentials, handleConnect])

  useEffect(() => {
    const allData = getAllRithmicData()
    const lastCredential = Object.values(allData)[0]
    if (lastCredential && user?.id) {
      setCredentials({
        ...lastCredential.credentials,
        userId: user.id
      })
      setSelectedAccounts(lastCredential.selectedAccounts)
      setShouldSaveCredentials(true)
    }
  }, [user?.id, setSelectedAccounts])

  const saveCredentialsAndAccounts = useCallback(() => {
    if (shouldSaveCredentials) {
      const allData = getAllRithmicData()
      
      const existingCredentials = Object.values(allData).filter(
        cred => cred.credentials.username === credentials.username
      )

      if (existingCredentials.length > 0) {
        const mergedSelectedAccounts = Array.from(new Set([
          ...selectedAccounts,
          ...existingCredentials.flatMap(cred => cred.selectedAccounts)
        ]))

        const mostRecentSync = Math.max(
          ...existingCredentials.map(cred => new Date(cred.lastSyncTime).getTime()),
          Date.now()
        )

        const mergedAllAccounts = allAccounts || existingCredentials.some(cred => cred.allAccounts)

        const dataToSave = {
          id: existingCredentials[0]!.id,
          credentials: {
            username: credentials.username,
            password: credentials.password,
            server_type: credentials.server_type,
            location: credentials.location
          },
          selectedAccounts: mergedSelectedAccounts,
          lastSyncTime: new Date(mostRecentSync).toISOString(),
          allAccounts: mergedAllAccounts
        }

        existingCredentials.forEach(cred => {
          if (cred.id !== dataToSave.id) {
            clearRithmicData(cred.id)
          }
        })

        saveRithmicData(dataToSave)
        setCurrentCredentialId(dataToSave.id)

        toast.success("Credentials Merged", {
          description: "Merged selected accounts into the existing credentials.",
        })
      } else {
        const dataToSave = {
          id: currentCredentialId || generateCredentialId(credentials.username),
          credentials: {
            username: credentials.username,
            password: credentials.password,
            server_type: credentials.server_type,
            location: credentials.location
          },
          selectedAccounts,
          lastSyncTime: new Date().toISOString(),
          allAccounts
        }

        saveRithmicData(dataToSave)
        setCurrentCredentialId(dataToSave.id)
      }
    }
  }, [credentials, selectedAccounts, shouldSaveCredentials, currentCredentialId, allAccounts])

  useEffect(() => {
    resetProcessingState()
    setStep('credentials')
    setIsLoading(false)
    setToken(null)
    setWsUrl(null)
    setShouldAutoConnect(false)
    setShowCredentialsManager(true)
    setCredentials({
      username: '',
      password: '',
      server_type: 'Rithmic Paper Trading',
      location: 'Chicago Area',
      userId: user?.id || ''
    })
  }, [resetProcessingState, user?.id, setToken, setWsUrl, setStep])

  useEffect(() => {
    if (processingStats.isComplete) {
      const timeoutId = setTimeout(() => {
        disconnect()
        setIsOpen(false)
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [processingStats.isComplete, setIsOpen, disconnect])

  useEffect(() => {
    if (user?.id) {
      setCredentials(prev => ({ ...prev, userId: user.id }))
    }
  }, [user])

  useEffect(() => {
    fetchServerConfigs()
  }, [fetchServerConfigs])

  useEffect(() => {
    if (isConnected && selectedAccounts.length > 0) {
      logger.info('Active connection detected, resuming processing view')
      setStep('processing')
    }
  }, [isConnected, selectedAccounts, setStep])

  const handleStartProcessing = useCallback(async () => {
    setIsLoading(true)
    setStep('processing')

    if (!token || !wsUrl) {
      setIsLoading(false)
      return
    }

    saveCredentialsAndAccounts()
    try {
      await setRithmicSynchronization({
        service: 'rithmic',
        accountId: credentials.username || '',
        token: token,
        tokenExpiresAt: null
      })
    } catch (error) {
      logger.error('Failed to save synchronization data: ' + (error instanceof Error ? error.message : String(error)))
      toast.error("Failed to save synchronization data", {
        description: "The connection succeeded, but synchronization metadata could not be saved to the database.",
      })
    }

    const accountsToSync = allAccounts ? availableAccounts.map(acc => acc.account_id) : selectedAccounts
    const startDate = calculateStartDate(accountsToSync)
    logger.info('Connecting to WebSocket: ' + wsUrl)
    connect(wsUrl, token, accountsToSync, startDate)
  }, [
    token,
    wsUrl,
    allAccounts,
    availableAccounts,
    selectedAccounts,
    saveCredentialsAndAccounts,
    calculateStartDate,
    connect,
    credentials.username,
    setStep,
  ])

  return (
    <div className="space-y-6">
      {step === 'processing' && (
        <div className="flex items-center gap-2 p-3 mb-2 rounded-md bg-muted/60 border border-primary/20">
          <Loader2 className="animate-spin h-5 w-5 text-primary" />
          <span className="text-sm font-medium text-primary">
            Rithmic sync in progress. Do not close this window.
          </span>
        </div>
      )}
      {(showCredentialsManager && (step === 'credentials' || step === 'processing')) ? (
        <RithmicCredentialsManager
          onSelectCredential={handleSelectCredential}
          onLoginMissingCredential={handleLoginWithSyncId}
          onAddNew={() => {
            setShowCredentialsManager(false)
            setSelectedAccounts([])
            setAvailableAccounts([])
            setAllAccounts(true)
            setAccountSearch('')
            setCredentials({
              username: '',
              password: '',
              server_type: 'Rithmic Paper Trading',
              location: 'Chicago Area',
              userId: user?.id || ''
            })
            setCurrentCredentialId(null)
          }}
        />
      ) : (
        <>
          {step === 'credentials' && (
            <form onSubmit={(e) => handleConnect(e, false)} className="space-y-4" autoComplete="on">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold">
                  {currentCredentialId ? "Edit Rithmic Credentials" : "Add Rithmic Credentials"}
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCredentialsManager(true)}
                >
                  Back to List
                </Button>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rithmic-username">Rithmic Username</Label>
                <Input 
                  id="rithmic-username" 
                  name="username"
                  autoComplete="username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  spellCheck="false"
                  required 
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="rithmic-password">Rithmic Password</Label>
                <Input 
                  id="rithmic-password" 
                  name="password"
                  type="password" 
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  required 
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="server-type">Server Type</Label>
                <Select
                  name="server-type"
                  value={credentials.server_type}
                  onValueChange={(value) => {
                    setCredentials(prev => ({ 
                      ...prev, 
                      server_type: value,
                      location: ''
                    }))
                  }}
                >
                  <SelectTrigger id="server-type">
                    <SelectValue placeholder="Select server type..." />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(serverConfigs).map((serverType) => (
                      <SelectItem key={serverType} value={serverType}>
                        {serverType}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location / Gateway</Label>
                <Select
                  name="location"
                  value={credentials.location}
                  onValueChange={(value) => setCredentials(prev => ({ ...prev, location: value }))}
                  disabled={!credentials.server_type}
                >
                  <SelectTrigger id="location">
                    <SelectValue placeholder="Select location..." />
                  </SelectTrigger>
                  <SelectContent>
                    {credentials.server_type && serverConfigs[credentials.server_type]?.map((location) => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center space-x-2 py-2">
                <Checkbox
                  id="save-credentials"
                  checked={shouldSaveCredentials}
                  onCheckedChange={(checked) => setShouldSaveCredentials(checked as boolean)}
                />
                <Label 
                  htmlFor="save-credentials"
                  className="text-sm text-muted-foreground cursor-pointer"
                >
                  {currentCredentialId ? "Update saved credentials" : "Save credentials securely in browser"}
                </Label>
              </div>

              <div className="flex justify-between">
                <Button 
                  type="submit" 
                  disabled={isLoading || !credentials.server_type || !credentials.location} 
                  className="w-full"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Retrieve Accounts
                </Button>
              </div>
            </form>
          )}

          {step === 'select-accounts' && (
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="sync-all"
                      checked={allAccounts}
                      onCheckedChange={(checked) => {
                        setAllAccounts(checked)
                        if (checked) {
                          setSelectedAccounts([])
                        }
                      }}
                    />
                    <div className="flex flex-col">
                      <Label 
                        htmlFor="sync-all"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Sync All Accounts
                      </Label>
                      <span className="text-xs text-muted-foreground">
                        Automatically synchronize all active accounts under this login
                      </span>
                    </div>
                  </div>
                </div>

                {!allAccounts && (
                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <Input
                        placeholder="Search accounts..."
                        value={accountSearch}
                        onChange={(e) => setAccountSearch(e.target.value)}
                        className="flex-1"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAccountSearch('')}
                      >
                        Clear
                      </Button>
                    </div>

                    <div className="flex items-center space-x-2 p-2 rounded bg-accent/50">
                      <Checkbox
                        id="select-all"
                        checked={selectedAccounts.length === filteredAccounts.length}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedAccounts(filteredAccounts.map(acc => acc.account_id))
                          } else {
                            setSelectedAccounts([])
                          }
                        }}
                      />
                      <Label 
                        htmlFor="select-all"
                        className="text-sm font-medium cursor-pointer"
                      >
                        Select All Accounts
                      </Label>
                    </div>

                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                      {filteredAccounts.map((account) => (
                        <div key={account.account_id} className="flex items-center space-x-2 p-2 rounded hover:bg-accent">
                           <Checkbox
                            id={account.account_id}
                            checked={selectedAccounts.includes(account.account_id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedAccounts([...selectedAccounts, account.account_id])
                              } else {
                                setSelectedAccounts(selectedAccounts.filter(id => id !== account.account_id))
                              }
                            }}
                          />
                          <Label 
                            htmlFor={account.account_id}
                            className="flex-1 cursor-pointer"
                          >
                            {account.account_id} 
                            <span className="text-sm text-muted-foreground ml-2">
                              (FCM ID: {account.fcm_id})
                            </span>
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep('credentials')
                    setSelectedAccounts([])
                    setAvailableAccounts([])
                    setAllAccounts(true)
                    setAccountSearch('')
                  }}
                  disabled={isLoading}
                >
                  Back
                </Button>
                <Button
                  onClick={handleStartProcessing}
                  disabled={isLoading || (!allAccounts && selectedAccounts.length === 0)}
                  className="flex-1"
                >
                  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {allAccounts 
                    ? "Start Syncing All Accounts"
                    : selectedAccounts.length === 1 
                      ? "Start Syncing 1 Account"
                      : `Start Syncing ${selectedAccounts.length} Accounts`
                  }
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface RithmicSyncWrapperProps {
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  onBack?: () => void
}

export function RithmicSyncWrapper({ setIsOpen, onBack }: RithmicSyncWrapperProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-4">
        {onBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="mt-1 h-8 px-3 text-xs border-border/50 hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
        )}
        <h2 className="text-2xl font-bold font-semibold">Rithmic Automated Sync</h2>
      </div>
      <RithmicSyncConnection 
        setIsOpen={setIsOpen}
      />
      <div className="mt-6 text-xs text-muted-foreground space-y-2 border-t pt-4">
        <div className="flex items-center gap-4 mb-2">
          <Image 
            src="/logos/TradingPlatformByRithmic-Black.png"
            alt="Trading Platform by Rithmic"
            width={120}
            height={40}
            className="dark:hidden"
          />
          <Image 
            src="/logos/TradingPlatformByRithmic-Green.png"
            alt="Trading Platform by Rithmic"
            width={120}
            height={40}
            className="hidden dark:block"
          />
          <Image 
            src="/logos/Powered_by_Omne.png"
            alt="Powered by OMNE"
            width={120}
            height={40}
          />
        </div>
        <p>Trading Platform by Rithmic, R|API, R|API+, R|Protocol and Rithmic are trademarks of Rithmic, LLC.</p>
        <p>Rithmic protocol integration runs directly via WebSocket client. Your credentials are used solely to authenticate with Rithmic servers and are saved locally in your browser.</p>
        <p>Your username, server type, and location are saved to synchronize your daily trading performance.</p>
        <p>Powered by OMNE.</p>
      </div>
    </div>
  )
}
