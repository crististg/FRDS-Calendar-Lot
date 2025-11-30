import React from 'react'

type Props = {
  title?: string
  subtitle?: string
  children?: React.ReactNode
  imageLeft?: boolean
}

export default function AuthCard({ title, subtitle, children, imageLeft = false }: Props) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-6 py-12">
      <div className="w-full max-w-6xl rounded-3xl overflow-hidden shadow-lg bg-white border border-gray-100">
        <div className="grid grid-cols-1 md:grid-cols-2">
          {imageLeft ? (
            <>
              <div className="hidden md:flex items-center justify-center p-6 bg-white">
                <div className="w-full h-full flex items-center justify-center max-w-md">
                  <img
                    loading="lazy"
                    src="/logo-frds.png"
                    alt="Sigla FRDS"
                    className="w-full h-auto max-h-[420px] object-contain rounded-lg bg-white p-6"
                    style={{ display: 'block' }}
                  />
                </div>
              </div>

              <div className="p-10 md:p-12">
                <div className="mb-6">
                  {title && <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">{title}</h1>}
                  {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
                </div>

                <div className="space-y-6">{children}</div>
              </div>
            </>
          ) : (
            <>
              <div className="p-10 md:p-12">
                <div className="mb-6">
                  {title && <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 leading-tight">{title}</h1>}
                  {subtitle && <p className="mt-2 text-sm text-gray-500">{subtitle}</p>}
                </div>

                <div className="space-y-6">{children}</div>
              </div>

              <div className="hidden md:flex items-center justify-center p-6 bg-white">
                <div className="w-full h-full flex items-center justify-center max-w-md">
                  <img
                    loading="lazy"
                    src="/logo-frds.png"
                    alt="Sigla FRDS"
                    className="w-full h-auto max-h-[420px] object-contain rounded-lg bg-white p-6"
                    style={{ display: 'block' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
