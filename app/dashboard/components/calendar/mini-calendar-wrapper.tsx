'use client'

import React from "react"
import MiniCalendar from "./mini-calendar"
import { useData } from "@/context/data-provider"

export default function MiniCalendarWrapper() {
  const { calendarData } = useData()

  return <MiniCalendar calendarData={calendarData} />
}

