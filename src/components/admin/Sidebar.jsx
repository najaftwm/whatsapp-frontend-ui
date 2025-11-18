import {
  BarChart3,
  MessageCircle,
  Settings,
  UserRound,
  LogOut,
  LayoutDashboard,
} from 'lucide-react'

const items = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'chat', label: 'Chats', icon: MessageCircle },
  { id: 'contacts', label: 'Contacts', icon: UserRound },
  { id: 'crm', label: 'CRM Settings', icon: Settings },
]

export default function Sidebar({ active, setActive, onLogout }) {
  return (
    <aside className="bg-[#0d2818] w-64 h-screen border-r border-emerald-900/30 flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-6 border-b border-emerald-900/20">
        <div className="w-12 h-12 bg-emerald-900/40 rounded-lg flex items-center justify-center border border-emerald-800/30">
          <BarChart3 size={28} className="text-emerald-400" />
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-medium text-emerald-400/70 tracking-wide uppercase">TNS</span>
          <h1 className="text-emerald-50 text-xl font-semibold">Admin Panel</h1>
        </div>
      </div>

      {/* Nav Section */}
      <nav className="flex flex-col gap-1 px-4 py-4 flex-1 overflow-y-auto">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <div
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-emerald-900/20 text-emerald-50'
                  : 'text-emerald-200/70 hover:text-emerald-50 hover:bg-emerald-900/10'
              }`}
            >
              <Icon size={20} className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </div>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="mt-auto px-6 py-6 border-t border-emerald-900/20">
        {onLogout && (
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-4 py-3 bg-red-950/30 hover:bg-red-950/50 text-red-400 hover:text-red-300 rounded-lg transition-all duration-200 cursor-pointer border border-red-900/30 hover:border-red-800/50"
          >
            <LogOut size={20} className="w-5 h-5" />
            <span className="font-medium">Logout</span>
          </button>
        )}
      </div>
    </aside>
  )
}

