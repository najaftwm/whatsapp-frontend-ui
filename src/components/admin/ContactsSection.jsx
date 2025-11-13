import { useMemo, useRef, useState } from 'react'
import { MinusCircle } from 'lucide-react'
import useContacts from './hooks/useContacts'
import AssignAgentDropdown from './AssignAgentDropdown'

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
  const buttonRefs = useRef({})

  const handleAssign = async (contactId, agentId) => {
    if (!contactId || !agentId) {
      console.error('Missing required IDs:', { contactId, agentId })
      throw new Error('Missing contact ID or agent ID')
    }
    
    console.log('Assigning agent:', { customer_id: contactId, agent_id: agentId })
    
    try {
      const res = await fetch('https://unimpaired-overfrugal-milda.ngrok-free.dev/backendfrontend/BACKENDPHP/api/assignAgent.php', {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: 'Bearer q6ktqrPs3wZ4kvZAzNdi7',
          'Content-Type': 'application/json',
        },
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
      alert('Unable to identify customer ID')
      return
    }

    // Only allow unassigning if there's an assigned agent
    if (!contact.assignedAgent) {
      alert('No agent assigned to unassign')
      return
    }

    const confirmed = window.confirm(`Unassign agent from ${contact.name}?`)
    if (!confirmed) return

    setDeletingContactId(contact.id)
    try {
      const res = await fetch(
        `https://unimpaired-overfrugal-milda.ngrok-free.dev/backendfrontend/BACKENDPHP/api/deleteAssignment.php?customer_id=${encodeURIComponent(customerId)}`,
        {
          method: 'GET',
          credentials: 'include',
          headers: {
            Authorization: 'Bearer q6ktqrPs3wZ4kvZAzNdi7',
            'Content-Type': 'application/json',
          },
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to unassign agent')
      }
      await refresh()
    } catch (unassignError) {
      console.error('Failed to unassign agent', unassignError)
      alert(unassignError?.message || 'Unable to unassign agent right now.')
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
    <div className="flex h-full flex-col bg-white">
      <header className="flex items-center justify-between border-b border-slate-100 px-8 py-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">All Contacts</h2>
          <p className="text-sm text-slate-500">Manage your customer database.</p>
        </div>
        <button className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600">
          + Add Contact
        </button>
      </header>

      <div className="flex-1 overflow-y-auto bg-white px-8 py-6">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            Loading contacts…
          </div>
        ) : error ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-3xl border border-rose-100 bg-rose-50 px-6 py-6 text-center">
            <p className="text-sm font-semibold text-rose-600">{error}</p>
            <button
              onClick={refresh}
              className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-600"
            >
              Retry
            </button>
          </div>
        ) : contactList.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
            No contacts yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-100 shadow-sm">
            <table className="min-w-full divide-y divide-slate-100 text-left">
              <thead className="bg-slate-50/80 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
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
              <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-600">
                {contactList.map((contact) => {
                  const isDropdownOpen = openContactId === contact.id
                  if (!buttonRefs.current[contact.id]) {
                    buttonRefs.current[contact.id] = { current: null }
                  }
                  const buttonRef = buttonRefs.current[contact.id]

                  return (
                    <tr key={contact.id} className="transition hover:bg-slate-50/80">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-emerald-600 text-white text-sm font-semibold shadow-sm">
                            {contact.initials}
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">{contact.name}</span>
                            {contact.email && (
                              <span className="text-xs text-slate-400">{contact.email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-slate-600">{contact.phoneLabel}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{contact.lastActiveLabel}</td>
                      <td className="px-6 py-4 text-sm text-slate-600">
                        {contact.assignedAgent ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-600">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            {contact.assignedAgent}
                          </span>
                        ) : (
                          <span className="text-xs italic text-slate-400">Unassigned</span>
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
                            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition ${
                              isDropdownOpen
                                ? 'bg-emerald-600'
                                : 'bg-emerald-500 hover:bg-emerald-600'
                            }`}
                          >
                            {contact.assignedAgent ? 'Change Agent' : 'Assign Agent'}
                          </button>
                          <button
                            onClick={() => handleUnassign(contact)}
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 text-rose-500 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
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

