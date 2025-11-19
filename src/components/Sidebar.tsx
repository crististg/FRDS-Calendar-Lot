import React from 'react'
import Icon from './Icon'

type Props = {
  selected: 'calendar' | 'settings' | 'my-events' | 'admin'
  onSelect: (s: 'calendar' | 'settings' | 'my-events' | 'admin') => void
  role?: string | null
}

export default function Sidebar({ selected, onSelect, role }: Props) {
  return (
  <aside className="w-56 md:w-64 shrink-0">
      <div className="bg-white rounded-2xl p-3 shadow">
        <div className="px-2 py-3 text-sm font-semibold text-gray-600">Meniu</div>

        <nav className="mt-2 space-y-2">
          <button
            onClick={() => onSelect('calendar')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <Icon name="calendar" className="h-4 w-4" />
            Calendar
          </button>

          <button
            onClick={() => onSelect('my-events')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'my-events' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <Icon name="users" className="h-4 w-4" />
            Evenimentele mele
          </button>

          {/* show admin panel button only for admin/arbitru/judge roles */}
          {(role || '').toLowerCase().includes('admin') || (role || '').toLowerCase().includes('arbitru') || (role || '').toLowerCase().includes('judge') ? (
            <button
              onClick={() => onSelect('admin')}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'admin' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
            >
              <Icon name="menu" className="h-4 w-4" />
              Admin
            </button>
          ) : null}

          <button
            onClick={() => onSelect('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <Icon name="settings" className="h-4 w-4" />
            Setări
          </button>
        </nav>
      </div>
    </aside>
  )
}
