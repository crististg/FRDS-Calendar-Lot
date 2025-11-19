import React, { useMemo, useState } from 'react'
import type { NextPage } from 'next'
import Head from 'next/head'
import { GetServerSideProps } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../api/auth/[...nextauth]'
// Render a large centered calendar (no AuthCard wrapper)
import DayModal from '../../components/DayModal'
import CreateEventModal from '../../components/CreateEventModal'
import Sidebar from '../../components/Sidebar'
import SettingsProfile from '../../components/SettingsProfile'
import dbConnect from '../../lib/mongoose'
import User from '../../models/User'

type DayCell = {
  date: Date
  inMonth: boolean
}

const weekdays = ['Lu', 'Ma', 'Mi', 'Jo', 'Vi', 'Sâ', 'Du']

function getMonthGrid(year: number, month: number): DayCell[] {
  // month: 0-11
  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)
  const startDay = (firstOfMonth.getDay() + 6) % 7 // convert Sun=0..Sat=6 to Mon=0..Sun=6

  const cells: DayCell[] = []
  // previous month's tail
  for (let i = 0; i < startDay; i++) {
    const d = new Date(year, month, i - startDay + 1)
    cells.push({ date: d, inMonth: false })
  }

  // current month
  for (let d = 1; d <= lastOfMonth.getDate(); d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true })
  }

  // fill to complete weeks (42 cells -> 6 weeks)
  while (cells.length % 7 !== 0) {
    const next = new Date(year, month, cells.length - startDay + 1)
    cells.push({ date: next, inMonth: false })
  }

  // ensure 6 rows
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date
    const next = new Date(last)
    next.setDate(last.getDate() + 1)
    cells.push({ date: next, inMonth: false })
  }

  return cells
}

const AppCalendar: NextPage<{ role?: string }> = ({ role }) => {
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [showDayModal, setShowDayModal] = useState(false)

  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth])

  const monthName = useMemo(() => new Intl.DateTimeFormat('ro-RO', { month: 'long' }).format(new Date(viewYear, viewMonth, 1)), [viewYear, viewMonth])

  function prevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11)
      setViewYear((y) => y - 1)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  function nextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0)
      setViewYear((y) => y + 1)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  const [panelView, setPanelView] = useState<'calendar' | 'settings'>('calendar')

  return (
    <>
      <Head>
        <title>Calendar — FRDS</title>
      </Head>

  <main className="max-w-screen-2xl mx-auto py-12 px-4">
        <div className="space-y-6">
          <div className="flex items-start gap-6">
            <Sidebar selected={panelView} onSelect={(s) => setPanelView(s)} />

            <div className="flex-1 bg-white rounded-2xl p-6 shadow-xl">
              {panelView === 'calendar' && (
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <button onClick={prevMonth} aria-label="Luna precedentă" className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                        <span className="text-2xl">‹</span>
                      </button>
                      <div className="text-2xl font-bold text-gray-900 tracking-tight">{monthName} {viewYear}</div>
                      <button onClick={nextMonth} aria-label="Luna următoare" className="p-2 rounded-md hover:bg-gray-100 text-gray-700">
                        <span className="text-2xl">›</span>
                      </button>
                    </div>
                    <div className="text-sm text-gray-500">Vizualizare lunară</div>
                  </div>

                  <div className="flex items-center gap-3">
                    {role?.toLowerCase() !== 'dansator' && (
                      <button onClick={() => { setShowCreate(true); setSelectedDate(today) }} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Creează eveniment
                      </button>
                    )}
                  </div>
                </div>
              )}

              {panelView === 'calendar' ? (
                <div className="p-4">
                  <div className="grid grid-cols-7 gap-2 text-center border-b pb-3 mb-3">
                    {weekdays.map((d, i) => (
                      // mark Sat(5) and Sun(6) as weekend in this Mon..Sun array
                      <div key={d} className={`text-xs font-semibold ${i >= 5 ? 'text-red-500' : 'text-gray-500'} uppercase`}>{d}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-3">
                    {grid.map((cell, idx) => {
                      const dateKey = cell.date.toDateString()
                      const isToday = dateKey === today.toDateString()
                      const inMonth = cell.inMonth
                      const weekday = cell.date.getDay() // 0=Sun .. 6=Sat
                      const isWeekend = weekday === 0 || weekday === 6
                      const cardBg = inMonth ? (isWeekend ? 'bg-red-50' : 'bg-white') : 'bg-gray-50 text-gray-400'
                      const hasEvent = Math.abs(cell.date.getDate() - today.getDate()) % 7 === 0 && inMonth

                      return (
                        <button
                          key={idx}
                          onClick={() => { setSelectedDate(cell.date); setShowDayModal(true) }}
                          className={`flex flex-col h-28 md:h-32 p-3 rounded-lg text-left transition-shadow ${cardBg} hover:shadow-md`}
                        >
                          <div className="flex items-start justify-between">
                            <div className={`text-sm font-semibold ${inMonth ? 'text-gray-900' : 'text-gray-400'}`}>{cell.date.getDate()}</div>
                            {isToday ? (
                              <div className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-600 text-white text-xs">Azi</div>
                            ) : (
                              <div className="text-xs text-gray-400">&nbsp;</div>
                            )}
                          </div>

                          <div className="mt-2 flex-1 flex flex-col justify-end">
                            {hasEvent ? (
                              <div className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-blue-600 inline-block" />
                                <span className="text-xs text-gray-700 truncate">Eveniment demo</span>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-300">&nbsp;</div>
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-6">
                  <h4 className="text-lg font-semibold mb-4">Setări</h4>
                  <div className="bg-white">
                    <div className="p-4">
                      <SettingsProfile />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

              <CreateEventModal
                open={showCreate}
                date={selectedDate}
                onClose={() => setShowCreate(false)}
                onSave={(payload) => {
                  // TODO: persist event; currently just log and close
                  console.log('create event', payload)
                  setShowCreate(false)
                }}
              />
              <DayModal open={showDayModal} date={selectedDate} onClose={() => setShowDayModal(false)} onCreate={(d) => {
                // Prevent dancers from creating events even via DayModal
                if (role?.toLowerCase() === 'dansator') return
                setShowCreate(true)
                setShowDayModal(false)
              }} />
      </main>
    </>
  )
}

export default AppCalendar

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getServerSession(context.req, context.res, authOptions as any)
  if (!session) {
    return {
      redirect: {
        destination: '/login',
        permanent: false,
      },
    }
  }

  // load user role from DB and pass to the page
  try {
    const userId = (session as any)?.user?.id
    await dbConnect()
    const user = await User.findById(userId).select('role').lean()
    const role = user?.role || null
    return { props: { role } }
  } catch (err) {
    console.error('[getServerSideProps] user lookup failed', err)
    return { props: {} }
  }
}
