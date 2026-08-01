import { apiRequest } from '@/lib/api/client'
import type { CalendarData } from '@/app/dashboard/types/calendar'

export type WeeklyReviewData = {
  id?: string
  startDate?: string | Date
  endDate?: string | Date
  calendarImage?: string | null
  expectation?: WeeklyExpectation | null
  actualOutcome?: WeeklyExpectation | null
  isCorrect?: boolean | null
  notes?: string | null
}

export async function getWeeklyReview(startDate: Date) {
  const response = await apiRequest<WeeklyReviewData | null>(
    `/api/v1/weekly-journal?startDate=${encodeURIComponent(startDate.toISOString())}`,
  )
  return response.data
}

export async function saveWeeklyReview(data: Record<string, unknown>): Promise<
  | { success: true; data: WeeklyReviewData }
  | { success: false; error: string }
> {
  try {
    const response = await apiRequest<WeeklyReviewData>('/api/v1/weekly-journal', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    if (!response.data) throw new Error('Weekly review save returned no data')
    return { success: true, data: response.data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save review',
    }
  }
}

export interface WeeklyModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  calendarData: CalendarData;
  isLoading: boolean;
}

export type WeeklyExpectation = 'BULLISH_EXPANSION' | 'BEARISH_EXPANSION' | 'CONSOLIDATION'

function weeklyReviewTextNode(text: string, format = 0) {
  return {
    detail: 0,
    format,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  }
}

function weeklyReviewParagraph(text = '', format = 0) {
  return {
    children: [weeklyReviewTextNode(text, format)],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  }
}

function weeklyReviewHeading(text: string) {
  return {
    children: [weeklyReviewTextNode(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'heading',
    tag: 'h3',
    version: 1,
  }
}

export const WEEKLY_REVIEW_NOTES_TEMPLATE = JSON.stringify({
  root: {
    children: [
      weeklyReviewHeading('Weekly Review'),
      weeklyReviewParagraph('Follow the steps below to complete the weekly review', 1),
      weeklyReviewParagraph('1. Address questions for winning trades'),
      weeklyReviewParagraph('2. Address questions for losing trades'),
      weeklyReviewParagraph('3. Address questions for overall performance'),
      weeklyReviewParagraph(''),

      weeklyReviewHeading('Winning Trades'),
      weeklyReviewParagraph('Is this a trade you would take again without knowing the outcome was a win?', 1),
      weeklyReviewParagraph('Yes:', 1),
      weeklyReviewParagraph('What would you improve with your execution on this trade?'),
      weeklyReviewParagraph('How could you have managed this trade to increase the profit?'),
      weeklyReviewParagraph('What can you do to repeat this type of trade in the future?'),
      weeklyReviewParagraph('No:', 1),
      weeklyReviewParagraph('Where did you deviate from your plan or approach and why?'),
      weeklyReviewParagraph('How could this flawed win have been avoided in the future?'),
      weeklyReviewParagraph('What specifically was done incorrectly in this trade despite the outcome?'),
      weeklyReviewParagraph(''),

      weeklyReviewHeading('Losing Trades'),
      weeklyReviewParagraph('Is this a trade you would take again without knowing the outcome was a loss?', 1),
      weeklyReviewParagraph('Yes:', 1),
      weeklyReviewParagraph('Was there any logical way to avoid this loss in the moment?'),
      weeklyReviewParagraph('What specifically was done well in this trade despite the outcome?'),
      weeklyReviewParagraph('Were emotions controlled after this losing trade was realized?'),
      weeklyReviewParagraph('No:', 1),
      weeklyReviewParagraph('Where did you deviate from your plan or approach and why?'),
      weeklyReviewParagraph('What were the warning signs that led into this losing trade?'),
      weeklyReviewParagraph('How did you respond to the outcome of this trade and did it impact following trades?'),
      weeklyReviewParagraph(''),

      weeklyReviewHeading('Overall Performance'),
      weeklyReviewParagraph('Is there a valid trade that you missed in the past week?', 1),
      weeklyReviewParagraph('What was the reason for missing it and how can you get onside with a similar move in the future?'),
      weeklyReviewParagraph(''),
      weeklyReviewParagraph('What did you do this week that you did not do last week and how did it impact the outcome?', 1),
      weeklyReviewParagraph('Did you execute your process better this week in comparison to the previous week?'),
      weeklyReviewParagraph('Did results from the previous week impact your mindset this week either positively or negatively?'),
      weeklyReviewParagraph('What actions must be taken now to ensure improvement is made next week?'),
      weeklyReviewParagraph(''),
      weeklyReviewParagraph('Did you notice any repeating strengths which resulted in positive outcomes that you want to build on?', 1),
      weeklyReviewParagraph('Identify: What caused these positive decisions?'),
      weeklyReviewParagraph('Purpose: Why is it important to continue these strengths?'),
      weeklyReviewParagraph('Action: What are the steps to further improve them going forward?'),
      weeklyReviewParagraph(''),
      weeklyReviewParagraph('Did you notice any repeating mistakes which resulted in negative outcomes that you need to resolve?', 1),
      weeklyReviewParagraph('Identify: What caused these poor decisions?'),
      weeklyReviewParagraph('Purpose: Why is it important to remove these mistakes?'),
      weeklyReviewParagraph('Action: What are the steps to avoid them going forward?'),
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})
