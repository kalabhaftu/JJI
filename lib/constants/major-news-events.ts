/**
 * Major Economic News Events and Bank Holidays
 * Based on ForexFactory high-impact (red folder) news events
 * These are recurring events that significantly impact forex markets
 */

export interface NewsEvent {
  id: string
  name: string
  category: 'employment' | 'inflation' | 'gdp' | 'interest-rate' | 'pmi' | 'retail' | 'housing' | 'bank-holiday' | 'trade' | 'manufacturing' | 'other'
  country: 'US' | 'EUR' | 'UK' | 'JP' | 'AU' | 'CA' | 'NZ' | 'CH' | 'GLOBAL'
  description: string
  isRedFolder?: boolean // High-impact (red folder) news from ForexFactory
  impact?: 'high' | 'medium' | 'low' // Impact level for market volatility
}

export const MAJOR_NEWS_EVENTS: NewsEvent[] = [
  // ========== US EVENTS ==========
  // Employment (RED FOLDER - High Impact)
  {
    id: 'us-nfp',
    name: 'Non-Farm Payrolls (NFP)',
    category: 'employment',
    country: 'US',
    description: 'Monthly employment report - highest impact',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-unemployment',
    name: 'Unemployment Rate',
    category: 'employment',
    country: 'US',
    description: 'Percentage of unemployed workers',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-adp',
    name: 'ADP Non-Farm Employment',
    category: 'employment',
    country: 'US',
    description: 'Private sector employment report',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-jobless-claims',
    name: 'Unemployment Claims',
    category: 'employment',
    country: 'US',
    description: 'Weekly initial jobless claims',
    impact: 'medium'
  },
  
  // Inflation (RED FOLDER - High Impact)
  {
    id: 'us-cpi',
    name: 'Consumer Price Index (CPI)',
    category: 'inflation',
    country: 'US',
    description: 'Monthly inflation measure',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-core-cpi',
    name: 'Core CPI',
    category: 'inflation',
    country: 'US',
    description: 'CPI excluding food and energy',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-ppi',
    name: 'Producer Price Index (PPI)',
    category: 'inflation',
    country: 'US',
    description: 'Wholesale inflation measure',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-pce',
    name: 'PCE Price Index',
    category: 'inflation',
    country: 'US',
    description: 'Fed\'s preferred inflation gauge',
    isRedFolder: true,
    impact: 'high'
  },
  
  // Interest Rates & Central Bank (RED FOLDER - High Impact)
  {
    id: 'us-fomc-rate',
    name: 'FOMC Interest Rate Decision',
    category: 'interest-rate',
    country: 'US',
    description: 'Federal Reserve interest rate decision',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-fomc-statement',
    name: 'FOMC Statement',
    category: 'interest-rate',
    country: 'US',
    description: 'Fed monetary policy statement',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-fomc-minutes',
    name: 'FOMC Meeting Minutes',
    category: 'interest-rate',
    country: 'US',
    description: 'Detailed meeting notes',
    impact: 'medium'
  },
  {
    id: 'us-fed-chair',
    name: 'Fed Chair Speech/Press Conference',
    category: 'interest-rate',
    country: 'US',
    description: 'Federal Reserve Chair public appearance',
    isRedFolder: true,
    impact: 'high'
  },
  
  // GDP (RED FOLDER - High Impact)
  {
    id: 'us-gdp',
    name: 'GDP (Gross Domestic Product)',
    category: 'gdp',
    country: 'US',
    description: 'Quarterly economic growth',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-gdp-advance',
    name: 'GDP Advance Estimate',
    category: 'gdp',
    country: 'US',
    description: 'First GDP estimate',
    isRedFolder: true,
    impact: 'high'
  },
  
  // PMI & Manufacturing (RED FOLDER - High Impact)
  {
    id: 'us-ism-manufacturing',
    name: 'ISM Manufacturing PMI',
    category: 'pmi',
    country: 'US',
    description: 'Manufacturing sector activity',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-ism-services',
    name: 'ISM Services PMI',
    category: 'pmi',
    country: 'US',
    description: 'Services sector activity',
    isRedFolder: true,
    impact: 'high'
  },
  
  // Retail & Consumer (RED FOLDER - High Impact)
  {
    id: 'us-retail-sales',
    name: 'Retail Sales',
    category: 'retail',
    country: 'US',
    description: 'Monthly consumer spending',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-consumer-confidence',
    name: 'Consumer Confidence',
    category: 'retail',
    country: 'US',
    description: 'Consumer sentiment index',
    impact: 'medium'
  },
  
  // Trade & Manufacturing (RED FOLDER - High Impact)
  {
    id: 'us-durable-goods',
    name: 'Durable Goods Orders',
    category: 'manufacturing',
    country: 'US',
    description: 'Orders for long-lasting manufactured goods',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-trade-balance',
    name: 'Trade Balance',
    category: 'trade',
    country: 'US',
    description: 'Difference between exports and imports',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-industrial-production',
    name: 'Industrial Production',
    category: 'manufacturing',
    country: 'US',
    description: 'Output of manufacturing, mining, and utilities',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-capacity-utilization',
    name: 'Capacity Utilization',
    category: 'manufacturing',
    country: 'US',
    description: 'Percentage of industrial capacity in use',
    impact: 'medium'
  },
  {
    id: 'us-factory-orders',
    name: 'Factory Orders',
    category: 'manufacturing',
    country: 'US',
    description: 'New orders for manufactured goods',
    impact: 'medium'
  },
  
  // Housing (RED FOLDER - High Impact)
  {
    id: 'us-housing-starts',
    name: 'Housing Starts',
    category: 'housing',
    country: 'US',
    description: 'New residential construction',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-building-permits',
    name: 'Building Permits',
    category: 'housing',
    country: 'US',
    description: 'New construction permits issued',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-existing-home-sales',
    name: 'Existing Home Sales',
    category: 'housing',
    country: 'US',
    description: 'Sales of previously owned homes',
    impact: 'medium'
  },
  {
    id: 'us-new-home-sales',
    name: 'New Home Sales',
    category: 'housing',
    country: 'US',
    description: 'Sales of newly constructed homes',
    impact: 'medium'
  },
  
  // Additional Important US Events
  {
    id: 'us-current-account',
    name: 'Current Account',
    category: 'trade',
    country: 'US',
    description: 'Balance of trade, income, and transfers',
    impact: 'medium'
  },
  {
    id: 'us-business-inventories',
    name: 'Business Inventories',
    category: 'manufacturing',
    country: 'US',
    description: 'Stock of goods held by businesses',
    impact: 'medium'
  },
  {
    id: 'us-philadelphia-fed',
    name: 'Philadelphia Fed Manufacturing Index',
    category: 'pmi',
    country: 'US',
    description: 'Regional manufacturing survey',
    impact: 'medium'
  },
  {
    id: 'us-jolts',
    name: 'JOLTS Job Openings',
    category: 'employment',
    country: 'US',
    description: 'Job Openings and Labor Turnover Survey',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-michigan-sentiment',
    name: 'UoM Consumer Sentiment',
    category: 'retail',
    country: 'US',
    description: 'University of Michigan Consumer Sentiment Index',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-cb-consumer-confidence',
    name: 'CB Consumer Confidence',
    category: 'retail',
    country: 'US',
    description: 'Conference Board Consumer Confidence',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-empire-state',
    name: 'Empire State Manufacturing',
    category: 'pmi',
    country: 'US',
    description: 'NY Fed manufacturing survey',
    impact: 'medium'
  },
  {
    id: 'us-core-pce',
    name: 'Core PCE Price Index',
    category: 'inflation',
    country: 'US',
    description: 'Fed\'s primary inflation metric',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-avg-hourly-earnings',
    name: 'Average Hourly Earnings',
    category: 'employment',
    country: 'US',
    description: 'Wage inflation indicator',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'us-crude-oil',
    name: 'Crude Oil Inventories',
    category: 'other',
    country: 'US',
    description: 'Weekly change in barrels of crude oil held by US firms',
    impact: 'medium'
  },
  {
    id: 'us-pending-home-sales',
    name: 'Pending Home Sales',
    category: 'housing',
    country: 'US',
    description: 'Signed contracts for existing homes',
    impact: 'medium'
  },
  
  // ========== EUROZONE EVENTS ==========
  {
    id: 'ecb-rate',
    name: 'ECB Interest Rate Decision',
    category: 'interest-rate',
    country: 'EUR',
    description: 'European Central Bank rate decision',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'ecb-press',
    name: 'ECB Press Conference',
    category: 'interest-rate',
    country: 'EUR',
    description: 'ECB President press conference',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'eur-cpi',
    name: 'Eurozone CPI',
    category: 'inflation',
    country: 'EUR',
    description: 'Eurozone inflation rate',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'eur-gdp',
    name: 'Eurozone GDP',
    category: 'gdp',
    country: 'EUR',
    description: 'Eurozone economic growth',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'eur-pmi-manufacturing',
    name: 'Eurozone Manufacturing PMI',
    category: 'pmi',
    country: 'EUR',
    description: 'Manufacturing activity',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'eur-pmi-services',
    name: 'Eurozone Services PMI',
    category: 'pmi',
    country: 'EUR',
    description: 'Services sector activity',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'eur-employment',
    name: 'Eurozone Employment Change',
    category: 'employment',
    country: 'EUR',
    description: 'Eurozone jobs data',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'eur-retail-sales',
    name: 'Eurozone Retail Sales',
    category: 'retail',
    country: 'EUR',
    description: 'Eurozone consumer spending',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'eur-industrial-production',
    name: 'Eurozone Industrial Production',
    category: 'manufacturing',
    country: 'EUR',
    description: 'Eurozone manufacturing output',
    impact: 'medium'
  },
  {
    id: 'eur-trade-balance',
    name: 'Eurozone Trade Balance',
    category: 'trade',
    country: 'EUR',
    description: 'Eurozone exports vs imports',
    impact: 'medium'
  },
  
  // ========== UK EVENTS ==========
  {
    id: 'boe-rate',
    name: 'BOE Interest Rate Decision',
    category: 'interest-rate',
    country: 'UK',
    description: 'Bank of England rate decision',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'uk-cpi',
    name: 'UK CPI',
    category: 'inflation',
    country: 'UK',
    description: 'UK inflation rate',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'uk-gdp',
    name: 'UK GDP',
    category: 'gdp',
    country: 'UK',
    description: 'UK economic growth',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'uk-employment',
    name: 'UK Employment Change',
    category: 'employment',
    country: 'UK',
    description: 'UK jobs data',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'uk-retail-sales',
    name: 'UK Retail Sales',
    category: 'retail',
    country: 'UK',
    description: 'UK consumer spending',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'uk-pmi-manufacturing',
    name: 'UK Manufacturing PMI',
    category: 'pmi',
    country: 'UK',
    description: 'UK manufacturing activity',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'uk-pmi-services',
    name: 'UK Services PMI',
    category: 'pmi',
    country: 'UK',
    description: 'UK services sector activity',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'uk-trade-balance',
    name: 'UK Trade Balance',
    category: 'trade',
    country: 'UK',
    description: 'UK exports vs imports',
    impact: 'medium'
  },
  
  // ========== JAPAN EVENTS ==========
  {
    id: 'boj-rate',
    name: 'BOJ Interest Rate Decision',
    category: 'interest-rate',
    country: 'JP',
    description: 'Bank of Japan rate decision',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'jp-cpi',
    name: 'Japan CPI',
    category: 'inflation',
    country: 'JP',
    description: 'Japan inflation rate',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'jp-gdp',
    name: 'Japan GDP',
    category: 'gdp',
    country: 'JP',
    description: 'Japan economic growth',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'jp-employment',
    name: 'Japan Employment Rate',
    category: 'employment',
    country: 'JP',
    description: 'Japan unemployment rate',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'jp-trade-balance',
    name: 'Japan Trade Balance',
    category: 'trade',
    country: 'JP',
    description: 'Japan exports vs imports',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'jp-industrial-production',
    name: 'Japan Industrial Production',
    category: 'manufacturing',
    country: 'JP',
    description: 'Japan manufacturing output',
    impact: 'medium'
  },
  {
    id: 'jp-retail-sales',
    name: 'Japan Retail Sales',
    category: 'retail',
    country: 'JP',
    description: 'Japan consumer spending',
    impact: 'medium'
  },
  
  // ========== AUSTRALIA EVENTS ==========
  {
    id: 'rba-rate',
    name: 'RBA Interest Rate Decision',
    category: 'interest-rate',
    country: 'AU',
    description: 'Reserve Bank of Australia rate decision',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'au-employment',
    name: 'Australia Employment Change',
    category: 'employment',
    country: 'AU',
    description: 'Australian jobs report',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'au-cpi',
    name: 'Australia CPI',
    category: 'inflation',
    country: 'AU',
    description: 'Australia inflation rate',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'au-gdp',
    name: 'Australia GDP',
    category: 'gdp',
    country: 'AU',
    description: 'Australia economic growth',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'au-retail-sales',
    name: 'Australia Retail Sales',
    category: 'retail',
    country: 'AU',
    description: 'Australia consumer spending',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'au-trade-balance',
    name: 'Australia Trade Balance',
    category: 'trade',
    country: 'AU',
    description: 'Australia exports vs imports',
    isRedFolder: true,
    impact: 'high'
  },
  
  // ========== CANADA EVENTS ==========
  {
    id: 'boc-rate',
    name: 'BOC Interest Rate Decision',
    category: 'interest-rate',
    country: 'CA',
    description: 'Bank of Canada rate decision',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'ca-employment',
    name: 'Canada Employment Change',
    category: 'employment',
    country: 'CA',
    description: 'Canadian jobs report',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'ca-cpi',
    name: 'Canada CPI',
    category: 'inflation',
    country: 'CA',
    description: 'Canada inflation rate',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'ca-gdp',
    name: 'Canada GDP',
    category: 'gdp',
    country: 'CA',
    description: 'Canada economic growth',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'ca-retail-sales',
    name: 'Canada Retail Sales',
    category: 'retail',
    country: 'CA',
    description: 'Canada consumer spending',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'ca-trade-balance',
    name: 'Canada Trade Balance',
    category: 'trade',
    country: 'CA',
    description: 'Canada exports vs imports',
    impact: 'medium'
  },
  
  // ========== NEW ZEALAND EVENTS ==========
  {
    id: 'rbnz-rate',
    name: 'RBNZ Interest Rate Decision',
    category: 'interest-rate',
    country: 'NZ',
    description: 'Reserve Bank of New Zealand rate decision',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'nz-employment',
    name: 'New Zealand Employment Change',
    category: 'employment',
    country: 'NZ',
    description: 'New Zealand jobs report',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'nz-cpi',
    name: 'New Zealand CPI',
    category: 'inflation',
    country: 'NZ',
    description: 'New Zealand inflation rate',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'nz-gdp',
    name: 'New Zealand GDP',
    category: 'gdp',
    country: 'NZ',
    description: 'New Zealand economic growth',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'nz-trade-balance',
    name: 'New Zealand Trade Balance',
    category: 'trade',
    country: 'NZ',
    description: 'New Zealand exports vs imports',
    impact: 'medium'
  },
  
  // ========== SWITZERLAND EVENTS ==========
  {
    id: 'snb-rate',
    name: 'SNB Interest Rate Decision',
    category: 'interest-rate',
    country: 'CH',
    description: 'Swiss National Bank rate decision',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'ch-cpi',
    name: 'Switzerland CPI',
    category: 'inflation',
    country: 'CH',
    description: 'Switzerland inflation rate',
    isRedFolder: true,
    impact: 'high'
  },
  {
    id: 'ch-gdp',
    name: 'Switzerland GDP',
    category: 'gdp',
    country: 'CH',
    description: 'Switzerland economic growth',
    impact: 'medium'
  },
  
  // ========== BANK HOLIDAYS ==========
  // US Bank Holidays
  {
    id: 'holiday-us-new-year',
    name: 'US New Year\'s Day',
    category: 'bank-holiday',
    country: 'US',
    description: 'January 1 - US markets closed'
  },
  {
    id: 'holiday-us-mlk',
    name: 'US Martin Luther King Jr. Day',
    category: 'bank-holiday',
    country: 'US',
    description: 'Third Monday in January'
  },
  {
    id: 'holiday-us-presidents',
    name: 'US Presidents\' Day',
    category: 'bank-holiday',
    country: 'US',
    description: 'Third Monday in February'
  },
  {
    id: 'holiday-us-good-friday',
    name: 'US Good Friday',
    category: 'bank-holiday',
    country: 'US',
    description: 'Friday before Easter - Markets closed'
  },
  {
    id: 'holiday-us-memorial',
    name: 'US Memorial Day',
    category: 'bank-holiday',
    country: 'US',
    description: 'Last Monday in May'
  },
  {
    id: 'holiday-us-independence',
    name: 'US Independence Day',
    category: 'bank-holiday',
    country: 'US',
    description: 'July 4 - US markets closed'
  },
  {
    id: 'holiday-us-labor',
    name: 'US Labor Day',
    category: 'bank-holiday',
    country: 'US',
    description: 'First Monday in September'
  },
  {
    id: 'holiday-us-columbus',
    name: 'US Columbus Day',
    category: 'bank-holiday',
    country: 'US',
    description: 'Second Monday in October'
  },
  {
    id: 'holiday-us-veterans',
    name: 'US Veterans Day',
    category: 'bank-holiday',
    country: 'US',
    description: 'November 11'
  },
  {
    id: 'holiday-us-thanksgiving',
    name: 'US Thanksgiving',
    category: 'bank-holiday',
    country: 'US',
    description: 'Fourth Thursday in November'
  },
  {
    id: 'holiday-us-christmas',
    name: 'US Christmas',
    category: 'bank-holiday',
    country: 'US',
    description: 'December 25 - US markets closed'
  },
  
  // UK Bank Holidays
  {
    id: 'holiday-uk-new-year',
    name: 'UK New Year\'s Day',
    category: 'bank-holiday',
    country: 'UK',
    description: 'January 1 - UK markets closed'
  },
  {
    id: 'holiday-uk-good-friday',
    name: 'UK Good Friday',
    category: 'bank-holiday',
    country: 'UK',
    description: 'Friday before Easter'
  },
  {
    id: 'holiday-uk-easter',
    name: 'UK Easter Monday',
    category: 'bank-holiday',
    country: 'UK',
    description: 'Monday after Easter'
  },
  {
    id: 'holiday-uk-early-may',
    name: 'UK Early May Bank Holiday',
    category: 'bank-holiday',
    country: 'UK',
    description: 'First Monday in May'
  },
  {
    id: 'holiday-uk-spring',
    name: 'UK Spring Bank Holiday',
    category: 'bank-holiday',
    country: 'UK',
    description: 'Last Monday in May'
  },
  {
    id: 'holiday-uk-summer',
    name: 'UK Summer Bank Holiday',
    category: 'bank-holiday',
    country: 'UK',
    description: 'Last Monday in August'
  },
  {
    id: 'holiday-uk-christmas',
    name: 'UK Christmas',
    category: 'bank-holiday',
    country: 'UK',
    description: 'December 25 - UK markets closed'
  },
  {
    id: 'holiday-uk-boxing',
    name: 'UK Boxing Day',
    category: 'bank-holiday',
    country: 'UK',
    description: 'December 26 - UK markets closed'
  },
  
  // Eurozone Bank Holidays
  {
    id: 'holiday-eur-new-year',
    name: 'Eurozone New Year\'s Day',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'January 1 - European markets closed'
  },
  {
    id: 'holiday-eur-epiphany',
    name: 'Eurozone Epiphany',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'January 6 - Some European markets closed'
  },
  {
    id: 'holiday-eur-good-friday',
    name: 'Eurozone Good Friday',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'Friday before Easter'
  },
  {
    id: 'holiday-eur-easter',
    name: 'Eurozone Easter Monday',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'Monday after Easter'
  },
  {
    id: 'holiday-eur-labor',
    name: 'Eurozone Labor Day',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'May 1 - European markets closed'
  },
  {
    id: 'holiday-eur-ascension',
    name: 'Eurozone Ascension Day',
    category: 'bank-holiday',
    country: 'EUR',
    description: '40 days after Easter'
  },
  {
    id: 'holiday-eur-whit-monday',
    name: 'Eurozone Whit Monday',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'Day after Pentecost'
  },
  {
    id: 'holiday-eur-assumption',
    name: 'Eurozone Assumption Day',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'August 15 - Some European markets closed'
  },
  {
    id: 'holiday-eur-all-saints',
    name: 'Eurozone All Saints\' Day',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'November 1 - Some European markets closed'
  },
  {
    id: 'holiday-eur-christmas',
    name: 'Eurozone Christmas',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'December 25 - European markets closed'
  },
  {
    id: 'holiday-eur-boxing',
    name: 'Eurozone Boxing Day/St. Stephen\'s Day',
    category: 'bank-holiday',
    country: 'EUR',
    description: 'December 26 - Some European markets closed'
  },
  
  // Japan Bank Holidays
  {
    id: 'holiday-jp-new-year',
    name: 'Japan New Year\'s Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'January 1 - Japan markets closed'
  },
  {
    id: 'holiday-jp-coming-age',
    name: 'Japan Coming of Age Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'Second Monday in January'
  },
  {
    id: 'holiday-jp-foundation',
    name: 'Japan National Foundation Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'February 11'
  },
  {
    id: 'holiday-jp-vernal',
    name: 'Japan Vernal Equinox Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'Around March 20-21'
  },
  {
    id: 'holiday-jp-golden-week',
    name: 'Japan Golden Week',
    category: 'bank-holiday',
    country: 'JP',
    description: 'April 29 - May 5 - Japan markets closed'
  },
  {
    id: 'holiday-jp-marine',
    name: 'Japan Marine Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'Third Monday in July'
  },
  {
    id: 'holiday-jp-mountain',
    name: 'Japan Mountain Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'August 11'
  },
  {
    id: 'holiday-jp-respect-aged',
    name: 'Japan Respect for the Aged Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'Third Monday in September'
  },
  {
    id: 'holiday-jp-autumnal',
    name: 'Japan Autumnal Equinox Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'Around September 22-23'
  },
  {
    id: 'holiday-jp-sports',
    name: 'Japan Sports Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'Second Monday in October'
  },
  {
    id: 'holiday-jp-culture',
    name: 'Japan Culture Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'November 3'
  },
  {
    id: 'holiday-jp-labor-thanks',
    name: 'Japan Labor Thanksgiving Day',
    category: 'bank-holiday',
    country: 'JP',
    description: 'November 23'
  },
  {
    id: 'holiday-jp-emperor',
    name: 'Japan Emperor\'s Birthday',
    category: 'bank-holiday',
    country: 'JP',
    description: 'February 23'
  },
  
  // Australia Bank Holidays
  {
    id: 'holiday-au-new-year',
    name: 'Australia New Year\'s Day',
    category: 'bank-holiday',
    country: 'AU',
    description: 'January 1 - Australia markets closed'
  },
  {
    id: 'holiday-au-australia-day',
    name: 'Australia Day',
    category: 'bank-holiday',
    country: 'AU',
    description: 'January 26'
  },
  {
    id: 'holiday-au-good-friday',
    name: 'Australia Good Friday',
    category: 'bank-holiday',
    country: 'AU',
    description: 'Friday before Easter'
  },
  {
    id: 'holiday-au-easter',
    name: 'Australia Easter Monday',
    category: 'bank-holiday',
    country: 'AU',
    description: 'Monday after Easter'
  },
  {
    id: 'holiday-au-anzac',
    name: 'Australia ANZAC Day',
    category: 'bank-holiday',
    country: 'AU',
    description: 'April 25'
  },
  {
    id: 'holiday-au-queen-birthday',
    name: 'Australia Queen\'s Birthday',
    category: 'bank-holiday',
    country: 'AU',
    description: 'Second Monday in June (varies by state)'
  },
  {
    id: 'holiday-au-labor',
    name: 'Australia Labor Day',
    category: 'bank-holiday',
    country: 'AU',
    description: 'First Monday in October (varies by state)'
  },
  {
    id: 'holiday-au-christmas',
    name: 'Australia Christmas',
    category: 'bank-holiday',
    country: 'AU',
    description: 'December 25 - Australia markets closed'
  },
  {
    id: 'holiday-au-boxing',
    name: 'Australia Boxing Day',
    category: 'bank-holiday',
    country: 'AU',
    description: 'December 26 - Australia markets closed'
  },
  
  // Canada Bank Holidays
  {
    id: 'holiday-ca-new-year',
    name: 'Canada New Year\'s Day',
    category: 'bank-holiday',
    country: 'CA',
    description: 'January 1 - Canada markets closed'
  },
  {
    id: 'holiday-ca-good-friday',
    name: 'Canada Good Friday',
    category: 'bank-holiday',
    country: 'CA',
    description: 'Friday before Easter'
  },
  {
    id: 'holiday-ca-easter',
    name: 'Canada Easter Monday',
    category: 'bank-holiday',
    country: 'CA',
    description: 'Monday after Easter'
  },
  {
    id: 'holiday-ca-victoria',
    name: 'Canada Victoria Day',
    category: 'bank-holiday',
    country: 'CA',
    description: 'Last Monday before May 25'
  },
  {
    id: 'holiday-ca-canada-day',
    name: 'Canada Day',
    category: 'bank-holiday',
    country: 'CA',
    description: 'July 1 - Canada markets closed'
  },
  {
    id: 'holiday-ca-labor',
    name: 'Canada Labor Day',
    category: 'bank-holiday',
    country: 'CA',
    description: 'First Monday in September'
  },
  {
    id: 'holiday-ca-thanksgiving',
    name: 'Canada Thanksgiving',
    category: 'bank-holiday',
    country: 'CA',
    description: 'Second Monday in October'
  },
  {
    id: 'holiday-ca-remembrance',
    name: 'Canada Remembrance Day',
    category: 'bank-holiday',
    country: 'CA',
    description: 'November 11'
  },
  {
    id: 'holiday-ca-christmas',
    name: 'Canada Christmas',
    category: 'bank-holiday',
    country: 'CA',
    description: 'December 25 - Canada markets closed'
  },
  {
    id: 'holiday-ca-boxing',
    name: 'Canada Boxing Day',
    category: 'bank-holiday',
    country: 'CA',
    description: 'December 26 - Canada markets closed'
  },
  
  // New Zealand Bank Holidays
  {
    id: 'holiday-nz-new-year',
    name: 'New Zealand New Year\'s Day',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'January 1 - New Zealand markets closed'
  },
  {
    id: 'holiday-nz-day-after-new-year',
    name: 'New Zealand Day After New Year\'s',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'January 2'
  },
  {
    id: 'holiday-nz-waitangi',
    name: 'New Zealand Waitangi Day',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'February 6'
  },
  {
    id: 'holiday-nz-good-friday',
    name: 'New Zealand Good Friday',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'Friday before Easter'
  },
  {
    id: 'holiday-nz-easter',
    name: 'New Zealand Easter Monday',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'Monday after Easter'
  },
  {
    id: 'holiday-nz-anzac',
    name: 'New Zealand ANZAC Day',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'April 25'
  },
  {
    id: 'holiday-nz-queen-birthday',
    name: 'New Zealand Queen\'s Birthday',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'First Monday in June'
  },
  {
    id: 'holiday-nz-labor',
    name: 'New Zealand Labor Day',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'Fourth Monday in October'
  },
  {
    id: 'holiday-nz-christmas',
    name: 'New Zealand Christmas',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'December 25 - New Zealand markets closed'
  },
  {
    id: 'holiday-nz-boxing',
    name: 'New Zealand Boxing Day',
    category: 'bank-holiday',
    country: 'NZ',
    description: 'December 26 - New Zealand markets closed'
  },
  
  // Switzerland Bank Holidays
  {
    id: 'holiday-ch-new-year',
    name: 'Switzerland New Year\'s Day',
    category: 'bank-holiday',
    country: 'CH',
    description: 'January 1 - Switzerland markets closed'
  },
  {
    id: 'holiday-ch-epiphany',
    name: 'Switzerland Epiphany',
    category: 'bank-holiday',
    country: 'CH',
    description: 'January 6'
  },
  {
    id: 'holiday-ch-good-friday',
    name: 'Switzerland Good Friday',
    category: 'bank-holiday',
    country: 'CH',
    description: 'Friday before Easter'
  },
  {
    id: 'holiday-ch-easter',
    name: 'Switzerland Easter Monday',
    category: 'bank-holiday',
    country: 'CH',
    description: 'Monday after Easter'
  },
  {
    id: 'holiday-ch-labor',
    name: 'Switzerland Labor Day',
    category: 'bank-holiday',
    country: 'CH',
    description: 'May 1'
  },
  {
    id: 'holiday-ch-ascension',
    name: 'Switzerland Ascension Day',
    category: 'bank-holiday',
    country: 'CH',
    description: '40 days after Easter'
  },
  {
    id: 'holiday-ch-whit-monday',
    name: 'Switzerland Whit Monday',
    category: 'bank-holiday',
    country: 'CH',
    description: 'Day after Pentecost'
  },
  {
    id: 'holiday-ch-national',
    name: 'Switzerland National Day',
    category: 'bank-holiday',
    country: 'CH',
    description: 'August 1'
  },
  {
    id: 'holiday-ch-christmas',
    name: 'Switzerland Christmas',
    category: 'bank-holiday',
    country: 'CH',
    description: 'December 25 - Switzerland markets closed'
  },
  {
    id: 'holiday-ch-boxing',
    name: 'Switzerland Boxing Day',
    category: 'bank-holiday',
    country: 'CH',
    description: 'December 26'
  },
  
  // ========== OTHER HIGH-IMPACT EVENTS ==========
  {
    id: 'geopolitical-crisis',
    name: 'Geopolitical Crisis/War',
    category: 'other',
    country: 'GLOBAL',
    description: 'Major geopolitical events affecting markets'
  },
  {
    id: 'financial-crisis',
    name: 'Financial Crisis/Bank Failure',
    category: 'other',
    country: 'GLOBAL',
    description: 'Major financial institution failures'
  },
  {
    id: 'natural-disaster',
    name: 'Natural Disaster',
    category: 'other',
    country: 'GLOBAL',
    description: 'Major natural disasters affecting markets'
  },
  {
    id: 'pandemic',
    name: 'Pandemic/Health Crisis',
    category: 'other',
    country: 'GLOBAL',
    description: 'Global health emergencies'
  }
]


function getNewsByCategory(category: NewsEvent['category']): NewsEvent[] {
  return MAJOR_NEWS_EVENTS.filter(event => event.category === category)
}

function getNewsByCountry(country: NewsEvent['country']): NewsEvent[] {
  return MAJOR_NEWS_EVENTS.filter(event => event.country === country || event.country === 'GLOBAL')
}

export function getNewsById(id: string): NewsEvent | undefined {
  return MAJOR_NEWS_EVENTS.find(event => event.id === id)
}

function searchNews(query: string): NewsEvent[] {
  const lowerQuery = query.toLowerCase()
  return MAJOR_NEWS_EVENTS.filter(event => 
    event.name.toLowerCase().includes(lowerQuery) ||
    event.description.toLowerCase().includes(lowerQuery)
  )
}

function getRedFolderNews(): NewsEvent[] {
  return MAJOR_NEWS_EVENTS.filter(event => event.isRedFolder === true)
}

function getHighImpactNews(): NewsEvent[] {
  return MAJOR_NEWS_EVENTS.filter(event => event.impact === 'high')
}

function getNewsByImpact(impact: 'high' | 'medium' | 'low'): NewsEvent[] {
  return MAJOR_NEWS_EVENTS.filter(event => event.impact === impact)
}

