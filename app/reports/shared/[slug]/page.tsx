import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { db } from '@/lib/db/client'
import { SharedReportView } from './shared-report-view'

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const report = await db.query.SharedReport.findFirst({
    where: (table, { eq }) => eq(table.slug, slug),
  })
  return {
    title: report?.title ? report.title : 'Shared Trading Report',
    description: 'View this shared trading performance report',
  }
}

export default async function SharedReportPage({ params }: Props) {
  const { slug } = await params
  const report = await db.query.SharedReport.findFirst({
    where: (table, { eq }) => eq(table.slug, slug),
  })

  if (!report || !report.isPublic) {
    notFound()
  }

  if (report.expiresAt && report.expiresAt < new Date()) {
    notFound()
  }

  return <SharedReportView report={report as any} />
}
