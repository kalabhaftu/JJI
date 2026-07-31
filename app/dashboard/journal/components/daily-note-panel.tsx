'use client'

import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { format } from 'date-fns'
import {
  X,
  Save,
  Trash2,
  Loader2,
  type LucideIcon,
  ShieldCheck,
  AlertTriangle,
  Target,
  Zap,
  Waves,
  Flame,
  TrendingUp,
  TrendingDown,
  Ruler,
  Gauge,
  Smile,
  Frown,
  Circle,
  Moon,
  Sparkles,
  Activity,
  Leaf,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'

const LexicalEditor = dynamic(
  () => import('@/components/ui/editor/lexical-editor').then(m => ({ default: m.LexicalEditor })),
  { ssr: false }
)
import { JOURNAL_EMOTIONS, getJournalEmotionLabel, type JournalEmotion } from '@/lib/journal-emotions'
import { useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'

interface DailyNote {
  id: string
  date: string
  note: string
  emotion: JournalEmotion | null
  createdAt: string
  updatedAt: string
}

interface DailyNotePanelProps {
  date: Date | null
  onClose: () => void
  dailyStats?: {
    pnl: number
    trades: number
    wins: number
    losses: number
  }
}

const EMOTION_ICONS: Record<JournalEmotion, LucideIcon> = {
  confident: ShieldCheck,
  anxious: AlertTriangle,
  focused: Target,
  energetic: Zap,
  calm: Waves,
  frustrated: Flame,
  optimistic: TrendingUp,
  pessimistic: TrendingDown,
  disciplined: Ruler,
  impulsive: Gauge,
  happy: Smile,
  sad: Frown,
  neutral: Circle,
  tired: Moon,
  excited: Sparkles,
  stressed: Activity,
  relaxed: Leaf,
}

export function DailyNotePanel({ date, onClose, dailyStats }: DailyNotePanelProps) {
  const queryClient = useQueryClient()
  const [isMounted, setIsMounted] = useState(false)
  const [note, setNote] = useState<DailyNote | null>(null)
  const [noteContent, setNoteContent] = useState<string>('')
  const [selectedEmotion, setSelectedEmotion] = useState<JournalEmotion | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const dateStr = date ? format(date, 'yyyy-MM-dd') : ''

  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  // Fetch existing note for this date
  useEffect(() => {
    if (!date) return

    const fetchNote = async () => {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/v1/journal/daily?date=${dateStr}`)
        const data = await res.json()
        if (data.journal) {
          setNote(data.journal)
          setNoteContent(data.journal.note || '')
          setSelectedEmotion(data.journal.emotion || null)
        } else {
          setNote(null)
          setNoteContent('')
          setSelectedEmotion(null)
        }
      } catch {
        toast.error('Failed to load daily note')
      } finally {
        setIsLoading(false)
      }
    }

    fetchNote()
  }, [date, dateStr])

  const handleSave = useCallback(async () => {
    if (!date) return
    setIsSaving(true)

    try {
      if (note) {
        // Update existing
        const res = await fetch(`/api/v1/journal/daily/${note.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note: noteContent, emotion: selectedEmotion }),
        })
        if (!res.ok) throw new Error('Failed to update')
        const data = await res.json()
        setNote(data.journal)
        queryClient.invalidateQueries({ queryKey: ['journal-data'] })
        toast.success('Daily note updated')
      } else {
        // Create new
        const res = await fetch('/api/v1/journal/daily', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ date: dateStr, note: noteContent, emotion: selectedEmotion }),
        })
        if (!res.ok) {
          const err = await res.json()
          throw new Error(err.error || 'Failed to create')
        }
        const data = await res.json()
        setNote(data.journal)
        queryClient.invalidateQueries({ queryKey: ['journal-data'] })
        toast.success('Daily note saved')
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save note')
    } finally {
      setIsSaving(false)
    }
  }, [date, dateStr, note, noteContent, queryClient, selectedEmotion])

  const handleDelete = useCallback(async () => {
    if (!note) return
    setIsDeleting(true)

    try {
      const res = await fetch(`/api/v1/journal/daily/${note.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setNote(null)
      setNoteContent('')
      setSelectedEmotion(null)
      queryClient.invalidateQueries({ queryKey: ['journal-data'] })
      toast.success('Daily note deleted')
    } catch {
      toast.error('Failed to delete note')
    } finally {
      setIsDeleting(false)
    }
  }, [note, queryClient])

  if (!date || !isMounted) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        key={`daily-note-panel-${dateStr}`}
        initial={{ x: '100%', opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 250 }}
        className="fixed inset-y-0 right-0 z-[10001] w-full sm:w-[480px] bg-background border-l border-border/40 shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border/30 bg-card/50">
          <div>
            <h2 className="text-sm font-black uppercase tracking-[0.15em] text-foreground">
              {format(date, 'EEEE, MMMM d, yyyy')}
            </h2>
            {dailyStats && dailyStats.trades > 0 && (
              <div className="flex items-center gap-3 mt-1">
                <span className={cn(
                  "text-xs font-bold font-mono",
                  dailyStats.pnl >= 0 ? "text-long" : "text-short"
                )}>
                  {dailyStats.pnl >= 0 ? '+' : ''}${dailyStats.pnl.toFixed(2)}
                </span>
                <span className="text-[10px] text-muted-foreground font-bold">
                  {dailyStats.trades} trades
                </span>
                <span className="text-[10px] font-bold">
                  <span className="text-long">{dailyStats.wins}W</span>
                  {' / '}
                  <span className="text-short">{dailyStats.losses}L</span>
                </span>
              </div>
            )}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8" aria-label="Close daily note panel">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Emotion Selector */}
            <div className="px-6 py-4 border-b border-border/20">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">How were you feeling?</p>
              <div className="mb-3 rounded-2xl border border-border/25 bg-muted/15 px-3 py-2">
                {selectedEmotion ? (() => {
                  const SelectedEmotionIcon = EMOTION_ICONS[selectedEmotion]
                  return (
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60">Logged emotion</span>
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-primary">
                        <SelectedEmotionIcon className="h-3 w-3" aria-hidden="true" />
                        {getJournalEmotionLabel(selectedEmotion)}
                      </span>
                    </div>
                  )
                })() : (
                  <p className="text-[10px] font-bold text-muted-foreground/70">No emotion logged yet.</p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {JOURNAL_EMOTIONS.map((emotion) => {
                  const EmotionIcon = EMOTION_ICONS[emotion]
                  return (
                    <button
                      key={emotion}
                      onClick={() => setSelectedEmotion(selectedEmotion === emotion ? null : emotion)}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border",
                        selectedEmotion === emotion
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40 hover:border-border/50"
                      )}
                    >
                      <EmotionIcon className="h-3 w-3" aria-hidden="true" />
                      {getJournalEmotionLabel(emotion)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Rich Text Editor */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">Daily Journal Note</p>
              <LexicalEditor
                value={noteContent}
                onChange={setNoteContent}
                placeholder="What happened today? Market conditions, your mindset, lessons learned..."
                minHeight="250px"
              />
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-border/30 bg-card/30 flex items-center justify-between">
              <div>
                {note && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    disabled={isDeleting || isSaving}
                    className="text-short hover:text-short hover:bg-short/10 text-xs font-bold gap-1.5"
                  >
                    {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    Delete
                  </Button>
                )}
              </div>
              <Button
                onClick={handleSave}
                disabled={isSaving || isDeleting}
                className="gap-1.5 text-xs font-black uppercase tracking-wider"
              >
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {note ? 'Update Note' : 'Save Note'}
              </Button>
            </div>
          </>
        )}
      </motion.div>

      {/* Backdrop */}
      <motion.div
        key={`daily-note-backdrop-${dateStr}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[10000] bg-black/40 backdrop-blur-sm"
      />
    </AnimatePresence>,
    document.body
  )
}
