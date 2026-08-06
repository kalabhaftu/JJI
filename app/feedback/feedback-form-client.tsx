'use client'

import { useState, useRef } from 'react'
import * as React from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, X, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'

const MAX_FILES = 3
const MAX_FILE_SIZE = 5 * 1024 * 1024
const DRAFT_STORAGE_KEY = 'jji_feedback_draft'

type FeedbackDraft = {
  name: string
  email: string
  category: string
  subject: string
  message: string
}

function loadDraft(): FeedbackDraft {
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    return { name: '', email: '', category: '', subject: '', message: '' }
  }
  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY)
    if (!raw) return { name: '', email: '', category: '', subject: '', message: '' }
    const parsed = JSON.parse(raw) as Partial<FeedbackDraft>
    return {
      name: typeof parsed.name === 'string' ? parsed.name : '',
      email: typeof parsed.email === 'string' ? parsed.email : '',
      category: typeof parsed.category === 'string' ? parsed.category : '',
      subject: typeof parsed.subject === 'string' ? parsed.subject : '',
      message: typeof parsed.message === 'string' ? parsed.message : '',
    }
  } catch {
    return { name: '', email: '', category: '', subject: '', message: '' }
  }
}

const SERVER_CODE_MESSAGES: Record<string, string> = {
  VALIDATION_ERROR: 'Some fields are missing or invalid. Please review your feedback.',
  TOO_MANY_FILES: 'Maximum 3 files allowed per submission.',
  FILE_TOO_LARGE: 'One of your attachments exceeds the 5MB limit.',
  UNSUPPORTED_FILE_TYPE: 'One of your attachments has an unsupported file type.',
  FILE_SIGNATURE_MISMATCH: 'One of your attachments does not match its file type.',
  ATTACHMENT_UPLOAD_FAILED: 'We could not upload your attachments. Please try again.',
  SERVER_ERROR: 'Something went wrong on our side. Please try again in a moment.',
}

export function FeedbackFormClient() {
  const initialDraft = React.useMemo(loadDraft, [])
  const [name, setName] = React.useState(initialDraft.name)
  const [email, setEmail] = React.useState(initialDraft.email)
  const [category, setCategory] = React.useState(initialDraft.category)
  const [subject, setSubject] = React.useState(initialDraft.subject)
  const [message, setMessage] = React.useState(initialDraft.message)
  const [files, setFiles] = React.useState<File[]>([])
  const [submitting, setSubmitting] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  const [isOffline, setIsOffline] = React.useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  const fileInputRef = useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') return
    const draft: FeedbackDraft = { name, email, category, subject, message }
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  }, [name, email, category, subject, message])

  const clearDraft = () => {
    if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newFiles = Array.from(e.target.files || [])
    const validFiles = newFiles.filter(f => {
      if (f.size > MAX_FILE_SIZE) { toast.error(`${f.name} exceeds 5MB`); return false }
      const ext = f.name.split('.').pop()?.toLowerCase()
      if (['exe', 'bat', 'sh', 'js', 'php', 'dll', 'cmd', 'ps1', 'vbs', 'msi'].includes(ext || '')) {
        toast.error(`${f.name}: file type not allowed`); return false
      }
      return true
    })
    setFiles(prev => [...prev, ...validFiles].slice(0, MAX_FILES))
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!category || !subject.trim() || !message.trim()) {
      toast.error('Please fill in all required fields')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const formData = new FormData()
      formData.append('category', category)
      formData.append('subject', subject.trim())
      formData.append('message', message.trim())
      if (name.trim()) formData.append('name', name.trim())
      if (email.trim()) formData.append('email', email.trim())
      files.forEach(f => formData.append('files', f))

      const res = await fetch('/api/v1/feedback', { method: 'POST', body: formData })
      const data = await res.json()

      if (data.success) {
        clearDraft()
        setSubmitted(true)
      } else {
        const code = typeof data.error?.code === 'string' ? data.error.code : ''
        const fallback = data.error?.message || 'Failed to submit feedback'
        const message = (code && SERVER_CODE_MESSAGES[code]) || fallback
        setSubmitError(message)
        toast.error(message)
      }
    } catch (error) {
      reportClientError(error, { operation: 'submit-feedback', route: '/api/feedback' })
      const message = isOffline
        ? 'You are offline. Reconnect and submit again; your message is still here.'
        : 'Something went wrong. Please try again.'
      setSubmitError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="p-4 rounded-full bg-success/10 mb-6">
          <CheckCircle2 className="h-12 w-12 text-success" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Thank You!</h1>
        <p className="text-muted-foreground max-w-md">
          Your feedback has been submitted successfully. We appreciate you taking the time to help us improve JJI.
        </p>
        <Button className="mt-6" onClick={() => { setSubmitted(false); setCategory(''); setSubject(''); setMessage(''); setFiles([]) }}>
          Submit Another
        </Button>
      </div>
    )
  }

  return (
    <>
      <Card className="border-border/70 bg-card/60 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.42)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What helps most</CardTitle>
          <CardDescription>
            Tell us what you expected, what happened instead, and how we can reproduce it.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
          <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-3">
            Include the page, widget, or flow involved.
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-3">
            Add screenshots or files when visual context matters.
          </div>
          <div className="rounded-xl border border-border/60 bg-background/50 px-4 py-3">
            Mention filters, account state, or browser/device if relevant.
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/70 bg-card/60 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.42)]">
        <CardContent className="pt-6">
          {isOffline && (
            <div className="mb-5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p role="alert" className="text-xs font-medium text-amber-700 dark:text-amber-300">
                You're offline. Your draft is saved — reconnect and submit when ready.
              </p>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs">Name <span className="text-muted-foreground">(optional)</span></Label>
                <Input placeholder="Your name" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Email <span className="text-muted-foreground">(optional)</span></Label>
                <Input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Category <span className="text-destructive">*</span></Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Select type..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUG_REPORT">Bug Report</SelectItem>
                  <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
                  <SelectItem value="GENERAL">General Feedback</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Subject <span className="text-destructive">*</span></Label>
              <Input placeholder="Brief summary of your feedback" value={subject} onChange={e => setSubject(e.target.value)} maxLength={200} />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Message <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder="Describe in detail..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={6}
                maxLength={5000}
              />
              <p className="text-[10px] text-muted-foreground text-right">{message.length}/5000</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Attachments <span className="text-muted-foreground">(max 3 files, 5MB each)</span></Label>
              <div className="flex items-center gap-2 flex-wrap">
                {files.map((f, i) => (
                  <div key={i} className="flex items-center gap-1 bg-muted px-2 py-1 rounded text-xs">
                    <span className="truncate max-w-32">{f.name}</span>
                    <span className="text-muted-foreground">({(f.size / 1024).toFixed(0)}KB)</span>
                    <Button type="button" variant="icon-only" size="icon" aria-label={`Remove ${f.name}`} onClick={() => removeFile(i)} className="ml-1 h-11 w-11 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {files.length < MAX_FILES && (
                  <Button type="button" variant="secondary" size="sm" className="text-xs" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="h-3 w-3 mr-1" />Attach File
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.csv,.txt,.doc,.docx"
                multiple
              />
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                Supported: images, PDF, CSV, TXT, DOC. No executables.
              </p>
            </div>

            {submitError && <p role="alert" className="text-sm text-destructive">{submitError}</p>}
            <Button type="submit" className="w-full" loading={submitting} loadingText="Submitting feedback" disabled={!category || !subject.trim() || !message.trim()}>
              Submit Feedback
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  )
}
