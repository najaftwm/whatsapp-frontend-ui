import {
  BarChart3,
  MessageCircle,
  Settings,
  UserRound,
} from 'lucide-react'

const items = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'contacts', label: 'Contacts', icon: UserRound },
  { id: 'crm', label: 'CRM Settings', icon: Settings },
]

export default function Sidebar({ active, setActive }) {
  return (
    <aside className="relative flex w-72 shrink-0 flex-col bg-linear-to-br from-emerald-600 via-emerald-500 to-emerald-400 text-white">
      <div className="absolute inset-x-0 top-0 h-28 bg-emerald-700/40 blur-3xl opacity-80 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="px-7 pb-6 pt-8 border-b border-white/15">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/15 shadow-inner">
              <BarChart3 size={20} />
            </div>
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-white/80 font-semibold">
                TNS
              </p>
              <h1 className="text-xl font-semibold leading-tight">Admin Panel</h1>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto px-4 py-6">
          <div className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-white text-emerald-600 shadow-lg shadow-emerald-900/10'
                      : 'text-white/80 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                      isActive
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                        : 'border-white/20 bg-white/5 group-hover:border-white/40'
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* User Info */}
        <div className="border-t border-white/10 px-6 py-5">
          <div className="flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-4 backdrop-blur">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-emerald-600 font-semibold">
              A
            </div>
            <div>
              <p className="text-sm font-semibold">Admin</p>
              <p className="text-xs text-white/75">Admin • Your Workspace</p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  )
}

