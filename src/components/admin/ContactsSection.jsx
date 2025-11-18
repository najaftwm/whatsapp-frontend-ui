import { useMemo, useRef, useState } from 'react'
import { MinusCircle, AlertTriangle, X, Check, Search, Tag, ChevronDown, Plus, Settings } from 'lucide-react'
import useContacts from './hooks/useContacts'
import AssignAgentDropdown from './AssignAgentDropdown'
import AddContactModal from './AddContactModal'
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

export default function ContactsSection({ onNavigateToSection }) {
  const { contacts, loading, error, refresh } = useContacts()
  const [openContactId, setOpenContactId] = useState(null)
  const [deletingContactId, setDeletingContactId] = useState(null)
  const [confirmUnassign, setConfirmUnassign] = useState(null)
  const [notification, setNotification] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddContactModal, setShowAddContactModal] = useState(false)
  const [highlightedContactId, setHighlightedContactId] = useState(null)
  const buttonRefs = useRef({})
  const contactRowRefs = useRef({})

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

  const handleContactCreated = async (newContact) => {
    // Refresh contacts list to show the newly created contact
    await refresh()
    setNotification({
      type: 'success',
      message: `Contact "${newContact.name || newContact.phone_number}" created successfully!`,
    })
    setTimeout(() => setNotification(null), 3000)
  }

  const handleNavigateToContact = (contactId) => {
    // Ensure we're on the contacts section
    if (onNavigateToSection) {
      onNavigateToSection('contacts')
    }
    
    // Clear search to ensure contact is visible
    setSearchQuery('')
    
    // Refresh contacts to ensure we have the latest data
    refresh().then(() => {
      // Wait a bit for the list to render, then scroll to the contact
      setTimeout(() => {
        const rowElement = contactRowRefs.current[contactId]
        if (rowElement) {
          rowElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
          // Highlight the contact briefly
          setHighlightedContactId(contactId)
          setTimeout(() => setHighlightedContactId(null), 3000)
        }
      }, 300)
    })
    
    setNotification({
      type: 'info',
      message: 'Navigating to existing contact...',
    })
    setTimeout(() => setNotification(null), 2000)
  }

  const contactList = useMemo(() => {
    let filtered = contacts.map((contact) => ({
      ...contact,
      initials: contact.name?.slice(0, 2).toUpperCase() || '??',
      phoneLabel: contact.phone || contact.phone_number || '—',
      lastActiveLabel: formatTimeLabel(contact.lastActive),
    }))

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter((contact) =>
        contact.name.toLowerCase().includes(query) ||
        contact.phoneLabel.includes(query)
      )
    }
    return filtered
  }, [contacts, searchQuery])

  return (
    <div className="flex h-full flex-col bg-[#0d1117] relative">
      {/* Confirmation Dialog */}
      {confirmUnassign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-[#1e293b] rounded-2xl border border-white/10 shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/20 border border-rose-500/30 shrink-0">
                <AlertTriangle className="text-rose-400" size={24} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-white mb-1">Unassign Agent</h3>
                <p className="text-sm text-white/70 mb-4">
                  Are you sure you want to unassign the agent from <span className="font-semibold text-white">{confirmUnassign.name}</span>?
                </p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={confirmUnassignAction}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:bg-rose-600 cursor-pointer"
                  >
                    <Check size={16} />
                    Confirm
                  </button>
                  <button
                    onClick={() => setConfirmUnassign(null)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/70 shadow-sm transition-all duration-200 hover:bg-white/10 hover:text-white cursor-pointer"
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
              : notification.type === 'info'
              ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
              : 'bg-rose-500/20 border-rose-500/30 text-rose-300'
          }`}>
            {notification.type === 'success' ? (
              <Check className="text-emerald-400" size={20} />
            ) : notification.type === 'info' ? (
              <AlertTriangle className="text-blue-400" size={20} />
            ) : (
              <AlertTriangle className="text-rose-400" size={20} />
            )}
            <span className="text-sm font-medium">{notification.message}</span>
            <button
              onClick={() => setNotification(null)}
              className="ml-2 text-white/40 hover:text-white/70 transition-all duration-200 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}
      <header className="flex items-center justify-between border-b border-white/10 px-8 py-6 bg-[#0f141a]/80 backdrop-blur-md">
        <div>
          <h2 className="text-2xl font-bold text-white mb-1">All Contacts</h2>
          <p className="text-sm text-white/60 font-medium">{contactList.length} TOTAL CONTACTS</p>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/70 bg-white/5 border border-white/10 transition-all duration-200 hover:bg-white/10 hover:text-white cursor-pointer">
            <Settings size={16} className="inline mr-2" />
            Contact Attributes
          </button>
          <button className="rounded-xl px-4 py-2.5 text-sm font-semibold text-white/70 bg-white/5 border border-white/10 transition-all duration-200 hover:bg-white/10 hover:text-white cursor-pointer">
            <Tag size={16} className="inline mr-2" />
            Contact Tags
          </button>
          <button
            onClick={() => setShowAddContactModal(true)}
            className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-emerald-50 shadow-lg shadow-emerald-900/30 border border-emerald-800/30 transition-all duration-200 hover:bg-emerald-800 cursor-pointer flex items-center gap-2"
          >
            <Plus size={16} />
            Add Contact
          </button>
        </div>
      </header>

      {/* Action and Filter Bar */}
      <div className="px-8 py-4 border-b border-white/10 bg-[#0f141a]/50 flex items-center gap-4 flex-wrap">
        <div className="relative">
          <select 
            className="rounded-xl px-4 py-2.5 text-sm font-medium text-white/70 bg-white/5 border border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 cursor-pointer appearance-none pr-10 transition-all duration-200 hover:bg-white/10"
          >
            <option value="">Select Tag For Search</option>
            <option value="tag1">Tag 1</option>
            <option value="tag2">Tag 2</option>
          </select>
          <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none" />
        </div>

        <div className="relative flex-1 min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" size={18} />
          <input
            type="text"
            placeholder="Search Contacts"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all duration-200"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[#0d1117] px-8 py-6">
        {loading ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5">
            <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-emerald-400 rounded-full" role="status" aria-label="loading">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        ) : error ? (
          <div className="mx-auto flex max-w-md flex-col items-center gap-4 rounded-2xl border border-rose-500/30 bg-rose-900/20 px-6 py-6 text-center">
            <p className="text-sm font-semibold text-rose-400">{error}</p>
            <button
              onClick={refresh}
              className="rounded-xl bg-emerald-900 px-4 py-2.5 text-sm font-semibold text-emerald-50 shadow-lg shadow-emerald-900/30 border border-emerald-800/30 transition-all duration-200 hover:bg-emerald-800 cursor-pointer"
            >
              Retry
            </button>
          </div>
        ) : contactList.length === 0 ? (
          <div className="flex h-full items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 text-sm text-white/50">
            No contacts yet.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-white/10 shadow-lg">
            <table className="min-w-full divide-y divide-white/10 text-left">
              <thead className="bg-white/5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
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
              <tbody className="divide-y divide-white/10 bg-white/5 text-sm text-white/80">
                {contactList.map((contact) => {
                  const isDropdownOpen = openContactId === contact.id
                  if (!buttonRefs.current[contact.id]) {
                    buttonRefs.current[contact.id] = { current: null }
                  }
                  const buttonRef = buttonRefs.current[contact.id]

                  const isHighlighted = highlightedContactId === contact.id
                  return (
                    <tr
                      key={contact.id}
                      ref={(el) => {
                        if (el) contactRowRefs.current[contact.id] = el
                      }}
                      className={`transition-all duration-200 hover:bg-white/5 ${
                        isHighlighted ? 'bg-amber-900/20 border-l-4 border-amber-500' : ''
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 text-white text-sm font-semibold">
                              {contact.initials}
                            </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-white">{contact.name}</span>
                            {contact.email && (
                              <span className="text-xs text-white/50">{contact.email}</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-white/70">{contact.phoneLabel}</td>
                      <td className="px-6 py-4 text-sm text-white/50">—</td>
                      <td className="px-6 py-4 text-sm text-white/70">
                        {contact.assignedAgent ? (
                          <span className="inline-flex items-center rounded-lg bg-emerald-900/40 px-3 py-1 text-xs font-semibold text-emerald-50 border border-emerald-800/30">
                            {contact.assignedAgent}
                          </span>
                        ) : (
                          <span className="text-xs italic text-white/40">Unassigned</span>
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
                            className={`inline-flex items-center rounded-xl px-3.5 py-1.5 text-xs font-semibold text-emerald-50 shadow-lg shadow-emerald-900/30 border border-emerald-800/30 transition-all duration-200 cursor-pointer ${
                              isDropdownOpen
                                ? 'bg-emerald-800'
                                : 'bg-emerald-900 hover:bg-emerald-800'
                            }`}
                          >
                            {contact.assignedAgent ? 'Change Agent' : 'Assign Agent'}
                          </button>
                          <button
                            onClick={() => handleUnassign(contact)}
                            className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 transition-all duration-200 hover:bg-rose-500/20 hover:border-rose-500/50 hover:text-rose-300 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-rose-500/10 disabled:hover:border-rose-500/30 disabled:hover:text-rose-400"
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

      {/* Add Contact Modal */}
      <AddContactModal
        isOpen={showAddContactModal}
        onClose={() => setShowAddContactModal(false)}
        onContactCreated={handleContactCreated}
        onNavigateToContact={handleNavigateToContact}
      />
    </div>
  )
}

