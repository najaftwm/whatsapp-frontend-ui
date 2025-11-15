import {
  BarChart3,
  MessageCircle,
  Settings,
  UserRound,
  LogOut,
} from 'lucide-react'

const items = [
  { id: 'chat', label: 'Chat', icon: MessageCircle },
  { id: 'contacts', label: 'Contacts', icon: UserRound },
  { id: 'crm', label: 'CRM Settings', icon: Settings },
]

export default function Sidebar({ active, setActive, onLogout }) {
  return (
    <aside className="relative flex w-64 shrink-0 flex-col bg-linear-to-br from-emerald-600 via-emerald-500 to-emerald-400 text-white">
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
                  className={`group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-emerald-600 shadow-lg shadow-emerald-900/10'
                      : 'text-white/80 hover:bg-black/20 hover:text-white'
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl border transition ${
                      isActive
                        ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                        : 'border-white/20 bg-white/5 group-hover:border-black/40 group-hover:bg-black/20'
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

        {/* Logout Button */}
        <div className="border-t border-white/10 px-6 py-5">
          {onLogout && (
            <button
              onClick={onLogout}
              className="group w-full flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-white/80 hover:text-white hover:bg-red-500/15 hover:border-red-400/30 transition-all duration-200 border border-white/10 hover:shadow-lg hover:shadow-red-500/10 cursor-pointer"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 group-hover:bg-red-500/20 group-hover:border-red-400/30 transition-all duration-200">
                <LogOut size={18} className="group-hover:text-red-200 transition-colors duration-200" />
              </span>
              <span className="group-hover:text-red-50 transition-colors duration-200">Logout</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

