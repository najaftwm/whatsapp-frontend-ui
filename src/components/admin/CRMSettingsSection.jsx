export default function CRMSettingsSection() {
  return (
    <div className="flex h-full flex-col bg-white">
      <header className="border-b border-slate-100 px-6 py-5">
        <h2 className="text-xl font-semibold text-slate-900">CRM Settings</h2>
        <p className="text-sm text-slate-500">
          Configure pipelines, tags, and automations for your workspace.
        </p>
      </header>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-2xl">
            ⚙️
          </div>
          <p className="text-lg font-semibold text-slate-700">Coming soon…</p>
          <p className="mt-2 text-sm text-slate-500">
            We're polishing this area of the dashboard. In the meantime, continue managing chats and
            contacts from the other sections.
          </p>
        </div>
      </div>
    </div>
  )
}

