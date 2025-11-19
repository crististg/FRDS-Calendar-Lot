import React from 'react'

type Props = {
  selected: 'calendar' | 'settings'
  onSelect: (s: 'calendar' | 'settings') => void
}

export default function Sidebar({ selected, onSelect }: Props) {
  return (
  <aside className="w-56 md:w-64 shrink-0">
      <div className="bg-white rounded-2xl p-3 shadow">
        <div className="px-2 py-3 text-sm font-semibold text-gray-600">Meniu</div>

        <nav className="mt-2 space-y-2">
          <button
            onClick={() => onSelect('calendar')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'calendar' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3M3 11h18M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Calendar
          </button>

          <button
            onClick={() => onSelect('settings')}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${selected === 'settings' ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317a9 9 0 018.358 8.358M6.6 6.6A9 9 0 1017.4 17.4" />
            </svg>
            Setări
          </button>
        </nav>
      </div>
    </aside>
  )
}
