import { Settings } from 'lucide-react'

export default function CRMSettingsSection() {
  return (
    <div className="flex h-full flex-col bg-[#0d1117]">
      <header className="border-b border-white/10 px-8 py-6 bg-[#0f141a]/80 backdrop-blur-md">
        <h2 className="text-xl font-semibold text-white">CRM Settings</h2>
        <p className="text-sm text-white/60">
          Configure pipelines, tags, and automations for your workspace.
        </p>
      </header>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-900/40 border border-emerald-800/30 shadow-lg shadow-emerald-900/30">
            <Settings className="text-emerald-400" size={32} />
          </div>
          <p className="text-lg font-semibold text-white">Coming soon…</p>
          <p className="mt-2 text-sm text-white/60">
            We're polishing this area of the dashboard. In the meantime, continue managing chats and
            contacts from the other sections.
          </p>
        </div>
      </div>
    </div>
  )
}

