import { Fragment } from 'react'
import { Dialog, Transition } from '@headlessui/react'
import { Link, useLocation } from 'react-router-dom'
import {
  XMarkIcon,
  HomeIcon,
  ChatBubbleLeftRightIcon,
  PaperAirplaneIcon,
  CreditCardIcon,
  Cog6ToothIcon,
  UserGroupIcon,
  ChartBarIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { useAuthStore } from '../../stores/authStore'
import { cn } from '../../lib/utils'

interface SidebarProps {
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
}

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Bots', href: '/bots', icon: ChatBubbleLeftRightIcon },
  { name: 'Messages', href: '/messages', icon: ChatBubbleLeftRightIcon },
  { name: 'Send Message', href: '/send', icon: PaperAirplaneIcon },
  { name: 'Billing', href: '/billing', icon: CreditCardIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

const adminNavigation = [
  { name: 'Admin Dashboard', href: '/admin', icon: ChartBarIcon },
  { name: 'Users', href: '/admin/users', icon: UserGroupIcon },
  { name: 'Connections', href: '/admin/connections', icon: ChatBubbleLeftRightIcon },
]

export default function Sidebar({ sidebarOpen, setSidebarOpen }: SidebarProps) {
  const { user, logout } = useAuthStore()
  const location = useLocation()

  const isAdmin = user?.role === 'admin' || user?.role === 'owner'
  const allNavigation = isAdmin ? [...navigation, ...adminNavigation] : navigation

  return (
    <>
      {/* Mobile sidebar */}
      <Transition.Root show={sidebarOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50 lg:hidden" onClose={setSidebarOpen}>
          <Transition.Child
            as={Fragment}
            enter="transition-opacity ease-linear duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="transition-opacity ease-linear duration-300"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-gray-900/80" />
          </Transition.Child>

          <div className="fixed inset-0 flex">
            <Transition.Child
              as={Fragment}
              enter="transition ease-in-out duration-300 transform"
              enterFrom="-translate-x-full"
              enterTo="translate-x-0"
              leave="transition ease-in-out duration-300 transform"
              leaveFrom="translate-x-0"
              leaveTo="-translate-x-full"
            >
              <Dialog.Panel className="relative mr-16 flex w-full max-w-xs flex-1">
                <Transition.Child
                  as={Fragment}
                  enter="ease-in-out duration-300"
                  enterFrom="opacity-0"
                  enterTo="opacity-100"
                  leave="ease-in-out duration-300"
                  leaveFrom="opacity-100"
                  leaveTo="opacity-0"
                >
                  <div className="absolute left-full top-0 flex w-16 justify-center pt-5">
                    <button
                      type="button"
                      className="-m-2.5 p-2.5"
                      onClick={() => setSidebarOpen(false)}
                    >
                      <span className="sr-only">Close sidebar</span>
                      <XMarkIcon className="h-6 w-6 text-white" aria-hidden="true" />
                    </button>
                  </div>
                </Transition.Child>

                <div className="flex grow flex-col gap-y-5 overflow-y-auto overflow-x-hidden bg-slate-950 px-5 pb-4 text-white">
                  <div className="flex h-20 shrink-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500 shadow-glow">
                      <SparklesIcon className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <h1 className="text-base font-bold text-white">WhatsApp API</h1>
                      <p className="text-xs text-slate-400">Automation platform</p>
                    </div>
                  </div>
                  <nav className="flex flex-1 flex-col">
                    <ul role="list" className="flex flex-1 flex-col gap-y-7">
                      <li>
                        <ul role="list" className="space-y-1">
                          {allNavigation.map((item) => (
                            <li key={item.name}>
                              <Link
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={cn(
                                  location.pathname === item.href
                                    ? 'bg-white text-slate-950 shadow-lg shadow-primary-950/20'
                                    : 'text-slate-300 hover:bg-white/10 hover:text-white',
                                  'group flex min-w-0 gap-x-3 rounded-xl px-3 py-2.5 text-sm leading-6 font-semibold transition-all'
                                )}
                              >
                                <item.icon
                                  className={cn(
                                    location.pathname === item.href
                                      ? 'text-primary-600'
                                      : 'text-slate-500 group-hover:text-primary-300',
                                    'h-5 w-5 shrink-0'
                                  )}
                                  aria-hidden="true"
                                />
                                <span className="truncate">{item.name}</span>
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </li>
                    </ul>
                  </nav>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </Dialog>
      </Transition.Root>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-72 lg:flex-col">
        <div className="m-4 flex grow flex-col gap-y-6 overflow-y-auto overflow-x-hidden rounded-3xl border border-white/10 bg-slate-950 px-4 shadow-2xl shadow-slate-950/20">
          <div className="flex h-20 shrink-0 items-center gap-3 px-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500 shadow-glow">
              <SparklesIcon className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">WhatsApp API</h1>
              <p className="text-xs text-slate-400">Monetization platform</p>
            </div>
          </div>
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="space-y-1">
                  {allNavigation.map((item) => (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={cn(
                          location.pathname === item.href
                            ? 'bg-white text-slate-950 shadow-lg shadow-primary-950/20'
                            : 'text-slate-300 hover:bg-white/10 hover:text-white',
                          'group flex min-w-0 gap-x-3 rounded-xl px-3 py-2.5 text-sm leading-6 font-semibold transition-all'
                        )}
                      >
                        <item.icon
                          className={cn(
                            location.pathname === item.href
                              ? 'text-primary-600'
                              : 'text-slate-500 group-hover:text-primary-300',
                            'h-5 w-5 shrink-0'
                          )}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.name}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
              <li className="-mx-6 mt-auto">
                <div className="mb-4 flex items-center gap-x-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold leading-6 text-white">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary-500">
                    <span className="text-sm font-bold text-white">
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <span className="sr-only">Your profile</span>
                  <span aria-hidden="true" className="flex-1 truncate">
                    {user?.email}
                  </span>
                  <button onClick={logout} className="text-xs text-slate-400 hover:text-white">
                    Logout
                  </button>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </div>
    </>
  )
}
