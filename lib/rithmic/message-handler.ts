import logger from '@/lib/logger'

interface RithmicMessageHandlerDependencies {
  accountsProgress: Record<string, any>
  currentAccount: string | null
  setLastMessage: (message: any) => void
  addMessageToHistory: (message: any) => void
  updateAccountProgress: (accountId: string, progress: any) => void
  setCurrentAccount: (accountId: string | null) => void
  refreshTrades: () => void
}

export function handleRithmicMessage(message: any, dependencies: RithmicMessageHandlerDependencies) {
  const {
    accountsProgress,
    currentAccount,
    setLastMessage,
    addMessageToHistory,
    updateAccountProgress,
    setCurrentAccount,
    refreshTrades,
  } = dependencies

  if (!message) return;

  setLastMessage(message);
  addMessageToHistory(message);

  switch (message.type) {
    case "log":
      if (message.level === "info") {
        // Handle initial days count message
        if (
          message.message.includes("Processing") &&
          message.message.includes("days of history")
        ) {
          const match = message.message.match(
            /Processing (\d+) days of history from \d{8}/
          );
          if (match) {
            const [, totalDays] = match;

            // Look for the most recently added account that doesn't have totalDays set
            const entries = Object.entries(accountsProgress);
            const activeAccount = entries.find(
              ([_, progress]) =>
                !progress.isComplete && progress.totalDays === 0
            );

            if (activeAccount) {
              const [accountId] = activeAccount;
              logger.debug({ accountId, totalDays }, "Setting Rithmic total days");
              updateAccountProgress(accountId, {
                totalDays: parseInt(totalDays),
                daysProcessed: 0,
                total: parseInt(totalDays),
              });
            } else {
              logger.warn(
                "No matching account found for setting total days:",
                {
                  totalDays,
                  message: message.message,
                }
              );
            }
          }
        }
        // Handle day-by-day progress
        else if (message.message.includes("Processing date")) {
          // Support both old and new message formats
          const newFormatMatch = message.message.match(
            /\[(.*?)\] Processing date (\d+)\/(\d+)(?:: (\d{8}))?/
          );
          const oldFormatMatch = message.message.match(
            /Processing date (\d+) of (\d+)(?:: (\d{8}))?/
          );

          let accountId: string | undefined;
          let currentDay: string | undefined;
          let totalDays: string | undefined;
          let currentDate: string | undefined = undefined;

          if (newFormatMatch) {
            [, accountId, currentDay, totalDays, currentDate] =
              newFormatMatch;
          } else if (oldFormatMatch) {
            [, currentDay, totalDays, currentDate] = oldFormatMatch;
            accountId = currentAccount || message.account_id;
          }

          if (accountId && currentDay && totalDays) {
            // Calculate the actual days processed based on the current day number
            const daysProcessed = Math.max(parseInt(currentDay) - 1, 0);
            const currentProgress = accountsProgress[accountId] || {
              processedDates: [],
            };

            updateAccountProgress(accountId, {
              currentDayNumber: parseInt(currentDay),
              totalDays: parseInt(totalDays),
              currentDate: currentDate || "",
              daysProcessed: daysProcessed,
              processedDates: currentProgress.processedDates || [],
              current: parseInt(currentDay),
              total: parseInt(totalDays),
            });
          }
        }
        // Handle completed dates
        else if (
          message.message.includes("Successfully processed orders for date")
        ) {
          const date = message.message.match(/date (\d{8})/)?.[1];
          const accountId = currentAccount || message.account_id;
          if (date && accountId) {
            const currentProgress = accountsProgress[accountId] || {
              ordersProcessed: 0,
              daysProcessed: 0,
              totalDays: 0,
              isComplete: false,
              processedDates: [],
              currentDayNumber: 0,
              currentDate: "",
              lastProcessedDate: "",
            };

            const newDaysProcessed = currentProgress.daysProcessed + 1;

            updateAccountProgress(accountId, {
              processedDates: [
                ...(currentProgress.processedDates || []),
                date,
              ],
              lastProcessedDate: date,
              daysProcessed: newDaysProcessed,
            });
          }
        }
        // Handle account initialization
        else if (message.message.includes("Successfully added account")) {
          const accountId = message.message.match(/account ([^"]+)/)?.[1];
          if (accountId) {
            updateAccountProgress(accountId, {
              ordersProcessed: 0,
              daysProcessed: 0,
              totalDays: 0,
              isComplete: false,
              processedDates: [],
              currentDayNumber: 0,
              currentDate: "",
              lastProcessedDate: "",
              current: 0,
              total: 0,
            });
          }
        }
        // Handle account start
        else if (
          message.message.includes("Starting processing for account")
        ) {
          const accountMatch = message.message.match(
            /account \d+ of \d+: ([^"\s]+)/
          );
          const accountId = accountMatch?.[1];
          if (accountId) {
            setCurrentAccount(accountId);
            updateAccountProgress(accountId, {
              ordersProcessed: 0,
              daysProcessed: 0,
              isComplete: false,
              processedDates: [],
              currentDayNumber: 0,
              currentDate: "",
              lastProcessedDate: "",
            });
          }
        }
        // Handle account completion
        else if (
          message.message.includes("Completed processing account") &&
          message.message.includes("collected")
        ) {
          const match = message.message.match(
            /account ([^,]+), collected (\d+) orders/
          );
          if (match) {
            const [, accountId, ordersStr] = match;
            const ordersCount = parseInt(ordersStr, 10);
            const currentProgress = accountsProgress[accountId];
            updateAccountProgress(accountId, {
              ordersProcessed: ordersCount,
              isComplete: true,
              daysProcessed: currentProgress?.totalDays || 0,
              currentDayNumber: currentProgress?.totalDays || 0,
            });
          }
        }
      }
      break;

    case "order_update":
      if (message.account_id) {
        const prevAccount = accountsProgress[message.account_id];
        if (prevAccount) {
          updateAccountProgress(message.account_id, {
            ordersProcessed: prevAccount.ordersProcessed + 1,
          });
        }
      }
      break;

    case "processing_complete":
      refreshTrades();
      break;

    case "status":
      if (message.all_complete) {
      }
      break;

    case "progress":
      const progressMatch = message.message.match(
        /\[(.*?)\] Processing date (\d+)\/(\d+)(?:: (\d{8}))?/
      );
      if (progressMatch) {
        const [, accountId, currentDay, totalDays, currentDate] =
          progressMatch;
        const current = parseInt(currentDay);
        const total = parseInt(totalDays);
        const prevAccount = accountsProgress[accountId] || {
          ordersProcessed: 0,
          daysProcessed: 0,
          totalDays: 0,
          isComplete: false,
          processedDates: [],
          currentDayNumber: 0,
          currentDate: "",
          current: 0,
          total: 0,
        };

        // Only update if it's a newer progress
        if (current > prevAccount.current || total !== prevAccount.total) {
          const daysProcessed = Math.max(current - 1, 0);

          updateAccountProgress(accountId, {
            currentDayNumber: current,
            totalDays: total,
            currentDate: currentDate || prevAccount.currentDate,
            daysProcessed,
            processedDates: [
              ...new Set([
                ...(prevAccount.processedDates || []),
                currentDate,
              ]),
            ].filter(Boolean),
            current,
            total,
            isComplete: current === total,
          });
        }

        // Update current account if not set
        if (!currentAccount) {
          setCurrentAccount(accountId);
        }
      }
      break;
  }
}
