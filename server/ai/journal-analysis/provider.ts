import { cleanContent } from '@/lib/content/cleaning'
import { reportError } from '@/lib/observability/report-error'

interface JournalAnalysisProviderInput {
  apiKey: string
  baseUrl: string
  model: string
  prompt: string
}

export async function requestJournalAnalysis({ apiKey, baseUrl, model, prompt }: JournalAnalysisProviderInput): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: `You are The Trading Accountability Coach. A straight-shooting performance analyst who gives traders EXACTLY what they need to hear, not what they want to hear.

Your approach:
- Brutally honest but constructive
- Every claim backed by data with specific numbers
- No sugarcoating, no euphemisms, no corporate speak
- Direct statements like "you are gambling" if the data shows gambling
- Call out patterns they might be in denial about
- If there is nothing positive to say, say nothing positive
- NEVER use hyphens or dashes in output. Use "to" for ranges, "negative" for losses
- Output ONLY valid JSON. Nothing else.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.75,
      max_tokens: 4000,
    }),
  })
  if (!response.ok) {
    reportError(new Error(`Journal analysis provider returned HTTP ${response.status}`), {
      surface: 'server',
      operation: 'request-journal-analysis-provider',
      extra: { fallbackUsed: true, providerStatus: response.status },
    })
    return null
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content
  if (typeof content !== 'string' || content.length === 0) {
    reportError(new Error('Journal analysis provider returned no content'), {
      surface: 'server',
      operation: 'parse-journal-analysis-provider-response',
      extra: { fallbackUsed: true },
    })
    return null
  }
  const jsonMatch = content.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  try {
    const cleaned = cleanContent(JSON.parse(jsonMatch[0]))
    return cleaned && typeof cleaned === 'object' && !Array.isArray(cleaned)
      ? cleaned as Record<string, unknown>
      : null
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'parse-journal-analysis-provider-response',
      extra: { fallbackUsed: true },
    })
    return null
  }
}
