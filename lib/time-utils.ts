import { formatInTimeZone, toZonedTime } from 'date-fns-tz';

export const DEFAULT_TIMEZONE = 'America/New_York';

export type MarketSession = 'Asia' | 'London' | 'New York';
export type KillzoneBadge = 'London Killzone' | 'NY Killzone' | 'Lunch Time' | 'NY PM Session';


const MARKET_SESSIONS = [
  { name: 'New York', start: 8, end: 17 },
  { name: 'London', start: 3, end: 8 },
  { name: 'Asia', start: 18, end: 3 },
];


const KILLZONE_BADGES = [
  { name: 'London Killzone', start: 2, end: 5 },
  { name: 'NY Killzone', start: 7, end: 10 },
  { name: 'Lunch Time', start: 11.5, end: 13 },
  { name: 'NY PM Session', start: 13, end: 16 },
];


export function getTradingSession(date: Date | string | number): MarketSession {
  if (!date) return 'Asia';
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return 'Asia';

  const nyDate = toZonedTime(parsedDate, DEFAULT_TIMEZONE);
  const hour = nyDate.getHours();
  const minute = nyDate.getMinutes();
  const time = hour + minute / 60;

  if (time >= 8 && time < 17) return 'New York';

  if (time >= 3 && time < 8) return 'London';

  return 'Asia';
}

export function getKillzoneBadge(date: Date | string | number, symbol?: string): KillzoneBadge | string | null {
  if (!date) return null;
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return null;

  const nyDate = toZonedTime(parsedDate, DEFAULT_TIMEZONE);
  const hour = nyDate.getHours();
  const minute = nyDate.getMinutes();
  const time = hour + minute / 60;


  const isIndex = symbol && (
    symbol.includes('US30') || 
    symbol.includes('NAS100') || 
    symbol.includes('SPX500') || 
    symbol.includes('GER30') || 
    symbol.includes('DAX') ||
    ['NQ', 'ES', 'YM'].some(s => symbol.startsWith(s))
  );

  if (isIndex) {
    if (time >= 8.5 && time < 11) return 'NY Killzone';
  } else {

    if (time >= 7 && time < 10) return 'NY Killzone';
  }


  for (const kz of KILLZONE_BADGES) {
    if (kz.name === 'NY Killzone') continue;
    
    if (time >= kz.start && time < kz.end) {
      return kz.name;
    }
  }

  return null;
}

function getNewYorkDateKey(date: Date | string | number): string {
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return '';
  return formatInTimeZone(parsedDate, DEFAULT_TIMEZONE, 'yyyy-MM-dd');
}

export function getNewYorkHour(date: Date | string | number): number | null {
  if (!date) return null;
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return null;
  return toZonedTime(parsedDate, DEFAULT_TIMEZONE).getHours();
}

export function getNewYorkWeekdayIndex(date: Date | string | number): number | null {
  if (!date) return null;
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return null;
  return toZonedTime(parsedDate, DEFAULT_TIMEZONE).getDay();
}

export function getWeekdayIndexInTimezone(
  date: Date | string | number,
  timezone: string = DEFAULT_TIMEZONE,
): number | null {
  if (!date) return null;
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return null;

  try {
    return toZonedTime(parsedDate, timezone).getDay();
  } catch (error) {
    return null;
  }
}

export function getHourInTimezone(
  date: Date | string | number,
  timezone: string = DEFAULT_TIMEZONE,
): number | null {
  if (!date) return null;
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return null;

  try {
    return toZonedTime(parsedDate, timezone).getHours();
  } catch (error) {
    return null;
  }
}

function formatUserTime(date: Date | string | number, timezone: string = DEFAULT_TIMEZONE, use24HourFormat: boolean = true): string {
  if (!date) return 'N/A';
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return 'N/A';

  const formatStr = use24HourFormat ? 'MMM d, yyyy HH:mm' : 'MMM d, yyyy h:mm a';
  return formatInTimeZone(parsedDate, timezone, formatStr);
}


export function formatTimeInZone(date: Date | string | number, formatStr: string = 'HH:mm', timezone: string = DEFAULT_TIMEZONE): string {
  if (!date) return 'N/A';
  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) return 'N/A';
  return formatInTimeZone(parsedDate, timezone, formatStr);
}


export function calculateTradeDuration(
  entryDate: Date | string | number | null | undefined,
  closeDate: Date | string | number | null | undefined,
  fallbackTimezone: string = DEFAULT_TIMEZONE
): number {
  if (!entryDate || !closeDate) return 0;

  try {

    const entry = normalizeToUTC(entryDate, fallbackTimezone);
    const close = normalizeToUTC(closeDate, fallbackTimezone);

    if (!entry || !close) return 0;
    
    const durationMs = close.getTime() - entry.getTime();
    

    if (durationMs < 0 || durationMs > 30 * 24 * 60 * 60 * 1000) {
      return 0;
    }
    
    return Math.round(durationMs / 1000);
  } catch (error) {
    return 0;
  }
}


function normalizeToUTC(
  date: Date | string | number,
  fallbackTimezone: string
): Date | null {
  if (!date) return null;
  

  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  

  if (typeof date === 'number') {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  

  const dateStr = String(date).trim();
  

  if (/Z$|[+-]\d{2}:\d{2}$|[+-]\d{4}$/.test(dateStr)) {
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  }
  

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(dateStr)) {

    try {
      const zonedDate = toZonedTime(new Date(dateStr + 'Z'), fallbackTimezone);
      const offset = getTimezoneOffset(fallbackTimezone, new Date(dateStr));
      const utcDate = new Date(zonedDate.getTime() - offset);
       return isNaN(utcDate.getTime()) ? new Date(dateStr) : utcDate;
     } catch (error) {
       return new Date(dateStr);
     }
  }
  

  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}


function getTimezoneOffset(timezone: string, date: Date): number {
  try {
    const utcDate = new Date(date.toLocaleString('en-US', { timeZone: 'UTC' }));
    const tzDate = new Date(date.toLocaleString('en-US', { timeZone: timezone }));
    return tzDate.getTime() - utcDate.getTime();
   } catch (error) {
     return 0;
   }
}

