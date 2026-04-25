import { useState } from 'react'
import { Bars3Icon } from '@heroicons/react/24/outline'
import Sidebar from './Sidebar'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="min-h-screen">
      <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Mobile header */}
      <div className="sticky top-0 z-40 flex items-center gap-x-6 border-b border-white/70 bg-white/85 px-4 py-4 shadow-lg shadow-slate-200/60 backdrop-blur sm:px-6 lg:hidden">
        <button
          type="button"
          className="-m-2.5 rounded-xl p-2.5 text-slate-700 hover:bg-slate-100 lg:hidden"
          onClick={() => setSidebarOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>
        <div className="flex-1 text-sm font-semibold leading-6 text-slate-950">
          WhatsApp API Platform
        </div>
      </div>

      {/* Main content */}
      <main className="py-8 lg:pl-72">
        <div className="px-4 sm:px-6 lg:px-10">{children}</div>
      </main>
    </div>
  )
}
