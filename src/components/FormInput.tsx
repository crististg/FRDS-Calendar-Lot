import React from 'react'

type Props = {
  label: string
  name: string
  type?: string
  value?: string
  placeholder?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}

export default function FormInput({ label, name, type = 'text', value, placeholder, onChange }: Props) {
  return (
    <div className="w-full">
      <label htmlFor={name} className="block text-sm font-medium text-gray-600 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          id={name}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 shadow-sm"
        />
      </div>
    </div>
  )
}
