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
    <aside className="relative flex w-64 shrink-0 flex-col bg-linear-to-br from-emerald-600 via-emerald-500 to-emerald-400 text-white" style={{ boxShadow: 'inset -1px 0 0 rgba(255, 255, 255, 0.05)' }}>
      <div className="absolute inset-x-0 top-0 h-28 bg-emerald-700/40 blur-3xl opacity-80 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="px-6 pb-5 pt-7 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm border border-white/20 shadow-lg">
              <BarChart3 size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-white/70 font-bold mb-0.5">
                TNS
              </p>
              <h1 className="text-lg font-bold leading-tight text-white tracking-tight">Admin Panel</h1>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 overflow-y-auto px-3 py-4">
          <div className="flex flex-col gap-0.5">
            {items.map((item) => {
              const Icon = item.icon
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActive(item.id)}
                  className={`group relative flex items-center gap-3 text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? ''
                      : 'hover:bg-white/5'
                  }`}
                  style={{
                    background: isActive ? 'rgba(0, 255, 140, 0.15)' : 'transparent',
                    borderRadius: '10px',
                    padding: '11px 16px',
                    color: isActive ? '#ffffff' : 'rgba(184, 196, 214, 0.9)'
                  }}
                >
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 ${
                      isActive
                        ? 'bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 shadow-sm'
                        : 'bg-white/5 border border-white/10 group-hover:bg-white/10 group-hover:border-white/20'
                    }`}
                    style={{
                      color: isActive ? '#6ee7b7' : 'rgba(184, 196, 214, 0.8)'
                    }}
                  >
                    <Icon size={16} />
                  </span>
                  <span className="truncate font-medium">{item.label}</span>
                </button>
              )
            })}
          </div>
        </nav>

        {/* Logout Button */}
        <div className="border-t border-white/10 px-4 py-4">
          {onLogout && (
            <button
              onClick={onLogout}
              className="group w-full flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-white/90 hover:text-white bg-red-500/10 hover:bg-red-500/20 border border-red-400/30 hover:border-red-400/50 transition-all duration-200 hover:shadow-lg hover:shadow-red-500/20 cursor-pointer"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-400/40 bg-red-500/15 group-hover:bg-red-500/25 group-hover:border-red-400/60 transition-all duration-200">
                <LogOut size={16} className="text-red-300 group-hover:text-red-200 transition-colors duration-200" />
              </span>
              <span className="text-red-200 group-hover:text-white transition-colors duration-200">Logout</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

