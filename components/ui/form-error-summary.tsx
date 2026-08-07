import * as React from "react"

import { cn } from "@/lib/utils"

type FormErrorSummaryProps = React.HTMLAttributes<HTMLDivElement> & {
  errors: Record<string, string | undefined>
  title?: string
}

export function FormErrorSummary({ errors, title, className, ...props }: FormErrorSummaryProps) {
  const entries = Object.entries(errors).filter((entry): entry is [string, string] => Boolean(entry[1]))
  if (entries.length === 0) return null

  return (
    <div
      {...props}
      role="alert"
      aria-live="assertive"
      className={cn("rounded-lg border border-destructive p-4 text-sm", className)}
    >
      <p className="font-semibold text-destructive">{title ?? `${entries.length} ${entries.length === 1 ? "error" : "errors"} need attention`}</p>
      <ul className="mt-2 list-disc ps-5">
        {entries.map(([field, message]) => (
          <li key={field}>
            <a className="underline underline-offset-4" href={`#${field}`}>{message}</a>
          </li>
        ))}
      </ul>
    </div>
  )
}