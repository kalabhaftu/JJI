-- Composite indexes for server-side filtering (/api/v1/trades)
CREATE INDEX IF NOT EXISTS "Trade_userId_instrument_idx" ON public."Trade" ("userId", "instrument");
CREATE INDEX IF NOT EXISTS "Trade_userId_accountNumber_entryDate_idx" ON public."Trade" ("userId", "accountNumber", "entryDate");
CREATE INDEX IF NOT EXISTS "Trade_userId_pnl_idx" ON public."Trade" ("userId", "pnl");;
