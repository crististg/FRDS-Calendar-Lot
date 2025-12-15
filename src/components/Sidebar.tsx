import React, { useState } from 'react'
import Icon from './Icon'
import { useRouter } from 'next/router'

type Props = {
  selected: 'calendar' | 'settings' | 'my-events' | 'admin' | 'statistics' | 'pairs' | 'approvals'
  onSelect: (s: 'calendar' | 'settings' | 'my-events' | 'admin' | 'statistics' | 'pairs' | 'approvals') => void
  role?: string | null
}

export default function Sidebar({ selected, onSelect, role }: Props) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const content = (
    <div className="bg-white rounded-2xl p-3 shadow w-56 md:w-64">
      <div className="px-2 py-3 text-sm font-semibold text-gray-600">Meniu</div>

      <nav className="mt-2 space-y-2">
        <button
          onClick={() => { onSelect('calendar'); setOpen(false) }}
          className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
        >
          <Icon name="calendar" className="h-4 w-4" />
          Calendar
        </button>

        {(role || '').toLowerCase() !== 'guest' && !(role || '').toLowerCase().includes('admin') && (
          <button
            onClick={() => { onSelect('my-events'); setOpen(false) }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'my-events' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <Icon name="users" className="h-4 w-4" />
            Evenimentele mele
          </button>
        )}

        {(role || '').toLowerCase() === 'club' && (
          <button
            onClick={() => { onSelect('pairs'); setOpen(false) }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'pairs' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <Icon name="users" className="h-4 w-4" />
            Perechile mele
          </button>
        )}

        {((role || '').toLowerCase().includes('arbitru') || (role || '').toLowerCase().includes('judge')) && !(role || '').toLowerCase().includes('admin') ? (
          <>
            <button
              onClick={() => { onSelect('statistics'); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'statistics' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <Icon name="stats" className="h-4 w-4" />
              Statistici
            </button>

            <button
              onClick={() => { onSelect('admin'); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'admin' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <Icon name="menu" className="h-4 w-4" />
              Panou General
            </button>
          </>
        ) : (role || '').toLowerCase().includes('admin') ? (
          <>
            <button
              onClick={() => { onSelect('admin'); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'admin' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <Icon name="menu" className="h-4 w-4" />
              Panou General
            </button>
            <button
              onClick={() => { onSelect('approvals'); setOpen(false) }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'approvals' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <Icon name="check" className="h-4 w-4" />
              Aprobări
            </button>
          </>
        ) : null}

        {(role || '').toLowerCase() !== 'guest' && (
          <button
            onClick={() => { onSelect('settings'); setOpen(false) }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <Icon name="settings" className="h-4 w-4" />
            Setări
          </button>
        )}
      </nav>
      {(role || '').toLowerCase() === 'guest' && (
        <div className="mt-3">
          <button
            onClick={() => { document.cookie = 'guest=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'; router.push('/login') }}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            <Icon name="menu" className="h-4 w-4" />
            Ieși
          </button>
        </div>
      )}
    </div>
  )

  return (
    <>
      <aside className="hidden md:block shrink-0">
        {content}
      </aside>

      {/* show burger button only when menu is closed on mobile; hide when open to avoid extra X button */}
      {!open && (
        <button
          aria-label="Deschide meniul"
          onClick={() => setOpen(true)}
          className="md:hidden fixed top-4 right-4 z-50 p-2 bg-white rounded-md shadow hover:bg-gray-50"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 text-gray-700`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}

      {open && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="relative ml-auto p-4">
            {content}
            {/* Guest exit button (clears guest cookie and returns to login) */}
            {(role || '').toLowerCase() === 'guest' && (
              <div className="mt-3">
                <button
                  onClick={() => { document.cookie = 'guest=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'; router.push('/login') }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                >
                  <Icon name="menu" className="h-4 w-4" />
                  Ieși
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}
