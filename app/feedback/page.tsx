import { MessageSquare } from 'lucide-react'
import { FeedbackFormClient } from './feedback-form-client'

export const metadata = {
  title: 'Feedback | JJI',
  description: 'Submit product feedback, bugs, and feature requests.'
}

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-3 mb-10">
        <p className="text-xs font-black uppercase tracking-[0.24em] text-muted-foreground">
          Product Feedback
        </p>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          Send Feedback
        </h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl">
          Use this form for bugs, feature requests, and product feedback. Clear reproduction steps,
          screenshots, and account context help us review issues faster.
        </p>
      </div>

      <FeedbackFormClient />
    </div>
  )
}
