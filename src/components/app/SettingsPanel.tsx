import React from 'react'
import SettingsProfile from '../../components/SettingsProfile'

export default function SettingsPanel() {
  return (
    <div className="p-6">
      <h4 className="text-lg font-semibold mb-4">Setări</h4>
      <div className="bg-white">
        <div className="p-4">
          <SettingsProfile />
        </div>
      </div>
    </div>
  )
}
