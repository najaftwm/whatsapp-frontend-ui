import { useMemo, useRef, useState } from 'react'
import { MinusCircle, AlertTriangle, X, Check } from 'lucide-react'
import useContacts from './hooks/useContacts'
import AssignAgentDropdown from './AssignAgentDropdown'
import { API_BASE_URL, AUTH_HEADERS } from '../../config/api'

function formatTimeLabel(raw) {
  if (!raw) return '—'
  const fallback = new Date(raw)
  const parseNumeric = (value) => {
    if (!value) return null
    const num = Number(value)
    if (Number.isNaN(num)) return null
    const ms = value.length === 10 ? num * 1000 : num
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date
  }

  let date = null
  if (typeof raw === 'number') {
    date = parseNumeric(String(raw))
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (trimmed) {
      date = /^\d+$/.test(trimmed) ? parseNumeric(trimmed) : new Date(trimmed.replace(' ', 'T'))
    }
  } else if (raw instanceof Date) {
    date = raw
  }

  if (!date || Number.isNaN(date.getTime())) {
    if (!Number.isNaN(fallback.getTime())) {
      date = fallback
    } else {
      return '—'
    }
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch (error) {
    console.error('Failed to format date', error)
    return '—'
  }
}

export default function ContactsSection() {
  const { contacts, loading, error, refresh } = useContacts()
  const [openContactId, setOpenContactId] = useState(null)
  const [deletingContactId, setDeletingContactId] = useState(null)
  const [confirmUnassign, setConfirmUnassign] = useState(null)
  const [notification, setNotification] = useState(null)
  const buttonRefs = useRef({})

  const handleAssign = async (contactId, agentId) => {
    if (!contactId || !agentId) {
      console.error('Missing required IDs:', { contactId, agentId })
      throw new Error('Missing contact ID or agent ID')
    }
    
    console.log('Assigning agent:', { customer_id: contactId, agent_id: agentId })
    
    try {
      const res = await fetch(`${API_BASE_URL}/assignAgent.php`, {
        method: 'POST',
        credentials: 'include',
        headers: AUTH_HEADERS,
        body: JSON.stringify({ customer_id: contactId, agent_id: agentId }),
      })
      
      const data = await res.json().catch((parseError) => {
        console.error('Failed to parse response:', parseError)
        return {}
      })
      
      console.log('Assignment response:', { status: res.status, data })
      
      if (!res.ok) {
        throw new Error(data?.error || `HTTP ${res.status}: ${res.statusText}`)
      }
      
      if (data?.ok !== true && data?.success !== true) {
        throw new Error(data?.error || data?.message || 'Failed to assign agent')
      }
      
      // Refresh contacts to get latest data from server
      console.log('Refreshing contacts after assignment...')
      await refresh()
      console.log('Contacts refreshed')
    } catch (assignError) {
      console.error('Failed to assign agent:', assignError)
      throw assignError
    }
  }

  const handleUnassign = async (contact) => {
    if (!contact?.id) return
    
    const customerId = contact.customer_id || contact.contact_id || contact.id
    if (!customerId) {
      setNotification({ type: 'error', message: 'Unable to identify customer ID' })
      setTimeout(() => setNotification(null), 3000)
      return
    }

    // Only allow unassigning if there's an assigned agent
    if (!contact.assignedAgent) {
      setNotification({ type: 'error', message: 'No agent assigned to unassign' })
      setTimeout(() => setNotification(null), 3000)
      return
    }

    // Show confirmation dialog
    setConfirmUnassign(contact)
  }

  const confirmUnassignAction = async () => {
    if (!confirmUnassign) return
    
    const contact = confirmUnassign
    const customerId = contact.customer_id || contact.contact_id || contact.id
    setConfirmUnassign(null)

    setDeletingContactId(contact.id)
    try {
      const res = await fetch(
        `${API_BASE_URL}/deleteAssignment.php?customer_id=${encodeURIComponent(customerId)}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: AUTH_HEADERS,
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to unassign agent')
      }
      await refresh()
      setNotification({ type: 'success', message: `Agent unassigned from ${contact.name}` })
      setTimeout(() => setNotification(null), 3000)
    } catch (unassignError) {
      console.error('Failed to unassign agent', unassignError)
      setNotification({ type: 'error', message: unassignError?.message || 'Unable to unassign agent right now.' })
      setTimeout(() => setNotification(null), 3000)
    } finally {
      setDeletingContactId(null)
    }
  }

  const contactList = useMemo(
    () =>
      contacts.map((contact) => ({
        ...contact,
        initials: contact.name?.slice(0, 2).toUpperCase() || '??',
        phoneLabel: contact.phone || contact.phone_number || '—',
        lastActiveLabel: formatTimeLabel(contact.lastActive),
      })),
    [contacts]
  )

  return (
    <div className="flex h-full flex-col bg-slate-900 relative">
      {/* Confirmation Dialog */}
      {confirmUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/30 shrink-0">
                <AlertTriangle className="text-rose-400" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-slate-100 mb-1">Unassign Agent</h3>
                <p className="text-sm text-slate-300 mb-4">
                  Are you sure you want to unassign the agent from <span className="font-semibold text-slate-100">{confirmUnassign.name}</span>?
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={confirmUnassignAction}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 cursor-pointer"
                  >
                    <Check size={16} />
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmUnassign(null)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-600 bg-slate-700/50 px-4 py-2.5 text-sm font-semibold text-slate-300 shadow-sm transition hover:bg-slate-700 hover:text-slate-100 cursor-pointer"
                  >
                    <X size={16} />
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notification Toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 animate-in slide-in-from-top-2">
          <div className={`flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg ${
            notification.type === 'success'
              ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
          }`}>
            {notification.type === 'success' ? (
              <Check className="text-emerald-400" size={20} />
            ) : (
              <AlertTriangle className="text-rose-400" size={20} />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-slate-400 hover:text-slate-200 transition cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between border-b border-slate-700 px-8 py-6 bg-slate-800/50">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">All Contacts</h2>
          <p className="text-sm text-slate-400">Manage your customer database.</p>
        </div>
        <button className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 cursor-pointer">
          + Add Contact
        </button>
      </header>

      <div className="flex-1 overflow-y-auto bg-slate-900 px-8 py-6">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-800">
            <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-emerald-500 rounded-full" role="status" aria-label="loading">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        ) : error ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-rose-800/50 bg-rose-900/30 px-6 py-6 text-center">
            <p className="text-sm font-semibold text-rose-400">{error}</p>
            <button
              onClick={refresh}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : contactList.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-slate-800 text-sm text-slate-400">
            No contacts yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-700 shadow-sm">
            <table className="min-w-full divide-y divide-slate-700 text-left">
              <thead className="bg-slate-800/80 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                <tr>
                  <th className="px-6 py-4">Name</th>
                  <th className="px-6 py-4">Phone</th>
                  <th className="px-6 py-4">Last Active</th>
                  <th className="px-6 py-4">Assigned To</th>
                  <th className="px-6 py-4">
                    <div className="flex justify-end pr-11">Actions</div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-slate-800 text-sm text-slate-300">
                {contactList.map((contact) => {
                  const isDropdownOpen = openContactId === contact.id
                  if (!buttonRefs.current[contact.id]) {
                    buttonRefs.current[contact.id] = { current: null }
                  }
                  const buttonRef = buttonRefs.current[contact.id]

                  return (
                    <tr key={contact.id} className="transition hover:bg-slate-700/50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-emerald-600 text-white text-sm font-semibold shadow-sm">
                            {contact.initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-100">{contact.name}</span>
                            {contact.email && (
                              <span className="text-xs text-slate-400">{contact.email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-300">{contact.phoneLabel}</td>
                      <td className="px-6 py-4 text-sm text-slate-400">{contact.lastActiveLabel}</td>
                      <td className="px-6 py-4 text-sm text-slate-300">
                        {contact.assignedAgent ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300 border border-emerald-500/30">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {contact.assignedAgent}
                          </span>
                        ) : (
                          <span className="text-xs italic text-slate-500">Unassigned</span>
                        )}
                      </td>
                      <td className="relative px-6 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            ref={(el) => {
                              buttonRef.current = el
                            }}
                            onClick={() =>
                              setOpenContactId((prev) => (prev === contact.id ? null : contact.id))
                            }
                            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition cursor-pointer ${
                              isDropdownOpen
                                ? 'bg-emerald-600'
                                : 'bg-emerald-500 hover:bg-emerald-600'
                            }`}
                          >
                            {contact.assignedAgent ? 'Change Agent' : 'Assign Agent'}
                          </button>
                          <button
                            onClick={() => handleUnassign(contact)}
                            className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 transition hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-500/10 disabled:hover:border-rose-500/30 disabled:hover:text-rose-400"
                            title={contact.assignedAgent ? "Unassign agent" : "No agent assigned"}
                            disabled={deletingContactId === contact.id || !contact.assignedAgent}
                          >
                            <MinusCircle size={16} />
                          </button>
                        </div>

                        <AssignAgentDropdown
                          contactId={contact.customer_id || contact.contact_id || contact.id}
                          onAssign={handleAssign}
                          isOpen={isDropdownOpen}
                          onClose={() => setOpenContactId(null)}
                          buttonRef={buttonRef}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

