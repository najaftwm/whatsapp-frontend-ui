import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, FileText, Paperclip, X } from 'lucide-react'
import { API_BASE_URL, AUTH_HEADERS } from '../../config/api'
import TemplatePopup from './TemplatePopup'
import MessageWithMedia from './MessageWithMedia'

const API_BASE = API_BASE_URL
const AUTH_HEADER = AUTH_HEADERS

function normalizeContacts(data) {
  if (!Array.isArray(data)) return []
  return data.map((item) => {
    const name = item.name || item.phone_number || 'Unknown'
    return {
      ...item,
      id: item.id ?? item.contact_id ?? item.phone_number ?? name,
      name,
      lastMessage: item.lastMessage ?? item.last_message ?? '',
      lastMessageTime:
        item.lastMessageTime ?? item.last_message_time ?? item.last_seen ?? item.time ?? '',
      avatar: item.avatar || name.slice(0, 2).toUpperCase(),
      assignedAgent:
        item.assigned_agent || 
        item.agent_name || 
        item.assigned_to || 
        item.assigned_agent_name ||
        item.agent?.name ||
        null,
    }
  })
}

function formatTime(raw) {
  if (!raw) return ''
  const toDate = (value) => {
    const d = new Date(value)
    return Number.isNaN(d.getTime()) ? null : d
  }

  let date = null
  if (typeof raw === 'number') {
    const ms = raw < 1e12 ? raw * 1000 : raw
    date = toDate(ms)
  } else if (typeof raw === 'string') {
    const trimmed = raw.trim()
    if (!trimmed) return ''
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed)
      date = toDate(trimmed.length === 10 ? numeric * 1000 : numeric)
    }
    if (!date) {
      const isoLike = trimmed.replace(' ', 'T')
      date = toDate(`${isoLike}Z`) ?? toDate(isoLike) ?? toDate(trimmed)
    }
  }

  if (!date) return ''

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date)
  } catch {
    return ''
  }
}

export default function ChatSection() {
  const [query, setQuery] = useState('')
  const [contacts, setContacts] = useState([])
  const [contactsLoading, setContactsLoading] = useState(false)
  const [contactsError, setContactsError] = useState('')

  const [activeContactId, setActiveContactId] = useState(null)
  const [messages, setMessages] = useState([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState('')
  const [messageInput, setMessageInput] = useState('')
  const [showTemplatePopup, setShowTemplatePopup] = useState(false)
  const [selectedMedia, setSelectedMedia] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const mediaCacheRef = useRef(new Map()) // Cache for media object URLs using ref to avoid re-renders

  const messageEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    let aborted = false

    async function fetchContacts() {
      setContactsLoading(true)
      setContactsError('')
      try {
        const res = await fetch(`${API_BASE}/getContacts.php`, {
          method: 'GET',
          credentials: 'include',
          headers: AUTH_HEADER,
        })
        const data = await res.json().catch(() => ({}))

        if (!res.ok || data?.ok !== true) {
          throw new Error(data?.error || 'Failed to load contacts')
        }

        if (aborted) return
        const mapped = normalizeContacts(data.contacts)
        setContacts(mapped)
        if (mapped.length) {
          setActiveContactId(mapped[0].id)
        }
      } catch (error) {
        if (!aborted) setContactsError(error?.message || 'Failed to load contacts')
      } finally {
        if (!aborted) setContactsLoading(false)
      }
    }

    fetchContacts()
    return () => {
      aborted = true
    }
  }, [])

  useEffect(() => {
    // Clear media selection when switching contacts
    setSelectedMedia(null)
    setMediaPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    
    if (!activeContactId) {
      setMessages([])
      return
    }

    let aborted = false
    async function fetchMessages() {
      setMessagesLoading(true)
      setMessagesError('')
      try {
        const res = await fetch(
          `${API_BASE}/getMessages.php?contact_id=${encodeURIComponent(activeContactId)}`,
          {
            credentials: 'include',
            headers: AUTH_HEADER,
          }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok || data?.ok !== true) {
          throw new Error(data?.error || 'Failed to load messages')
        }
        if (aborted) return
        const normalized = Array.isArray(data.messages)
          ? data.messages.map((msg) => ({
              id: msg.id ?? `${msg.timestamp}-${msg.sender_type}`,
              message: msg.message_text ?? msg.message ?? '',
              senderType: msg.sender_type ?? 'customer',
              timestamp: msg.timestamp ?? msg.time ?? '',
              mediaType: msg.media_type ?? null,
              mediaFilePath: msg.media_file_path ?? null,
              mediaFileName: msg.media_file_name ?? null,
            }))
          : []
        setMessages(normalized)
      } catch (error) {
        if (!aborted) setMessagesError(error?.message || 'Failed to load messages')
        setMessages([])
      } finally {
        if (!aborted) setMessagesLoading(false)
      }
    }

    fetchMessages()
    return () => {
      aborted = true
    }
  }, [activeContactId])

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const filteredContacts = useMemo(() => {
    if (!query.trim()) return contacts
    const q = query.trim().toLowerCase()
    return contacts.filter((contact) => {
      return (
        contact.name.toLowerCase().includes(q) ||
        (contact.lastMessage || '').toLowerCase().includes(q) ||
        String(contact.phone_number || '').toLowerCase().includes(q)
      )
    })
  }, [contacts, query])

  const activeContact = useMemo(
    () => contacts.find((contact) => contact.id === activeContactId) ?? null,
    [contacts, activeContactId]
  )

  const handleSend = async (templateText = null) => {
    const text = templateText || messageInput.trim()
    if (!activeContactId || !text) return
    
    if (!templateText) {
      setMessageInput('')
    }

    const tempId = `temp-${Date.now()}`
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        message: text,
        senderType: 'company',
        timestamp: new Date().toISOString(),
      },
    ])

    try {
      await fetch(`${API_BASE}/sendMessage.php`, {
        method: 'POST',
        credentials: 'include',
        headers: AUTH_HEADER,
        body: JSON.stringify({ contact_id: activeContactId, message: text }),
      })
    } catch (error) {
      // Error handled silently
    }
  }

  const handleTemplateSelect = (templateText) => {
    if (templateText && activeContactId) {
      handleSend(templateText)
    }
  }

  const handleMediaSelect = (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      alert('File size exceeds 50MB limit')
      return
    }

    setSelectedMedia(file)

    // Create preview
    const reader = new FileReader()
    reader.onload = (e) => {
      setMediaPreview(e.target.result)
    }

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file)
    } else if (file.type.startsWith('video/')) {
      reader.readAsDataURL(file)
    } else {
      setMediaPreview(null)
    }
  }

  const handleMediaUpload = async () => {
    if (!selectedMedia || !activeContactId || uploading) return

    setUploading(true)

    const formData = new FormData()
    formData.append('media', selectedMedia)
    formData.append('contact_id', activeContactId)
    if (messageInput.trim()) {
      formData.append('message', messageInput.trim())
    }

    const tempId = `temp-${Date.now()}`
    const messageText = messageInput.trim() || 'Media file'

    // Optimistic update
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        message: messageText,
        senderType: 'company',
        timestamp: new Date().toISOString(),
        mediaType: getMediaType(selectedMedia.type),
        mediaPreview: mediaPreview,
        isPending: true,
      },
    ])

    setMessageInput('')
    setSelectedMedia(null)
    setMediaPreview(null)

    try {
      const res = await fetch(`${API_BASE}/uploadMedia.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: AUTH_HEADER.Authorization,
        },
        body: formData,
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to upload media')
      }

      // Update message with server response
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === tempId
            ? {
                ...msg,
                id: data.message_id.toString(),
                mediaType: data.media_type,
                mediaFilePath: data.media_file_path,
                mediaFileName: data.media_file_name,
                isPending: false,
              }
            : msg
        )
      )
    } catch (error) {
      // Remove failed message
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
      alert(error?.message || 'Failed to upload media')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveMedia = () => {
    setSelectedMedia(null)
    setMediaPreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getMediaType = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('zip')) return 'document'
    return 'document'
  }

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      mediaCacheRef.current.forEach((url) => URL.revokeObjectURL(url))
      mediaCacheRef.current.clear()
    }
  }, [])

  return (
    <div className="flex h-full min-h-0 bg-slate-900">
      <aside className="flex w-80 min-h-0 flex-col border-r border-slate-700 bg-slate-800">
        <div className="flex items-center border-b border-slate-700 px-6 h-[72px]">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              type="text"
              placeholder="Search contacts…"
              className="w-full rounded-xl border border-slate-600 bg-slate-700 py-2 pl-10 pr-3 text-sm text-slate-100 shadow-sm placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
          {contactsLoading ? (
            <div className="flex items-center justify-center rounded-xl bg-slate-700 px-4 py-6">
              <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-emerald-500 rounded-full" role="status" aria-label="loading">
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          ) : contactsError ? (
            <div className="rounded-xl bg-rose-900/30 px-4 py-4 text-sm text-rose-400 shadow-sm border border-rose-800/50">
              {contactsError}
            </div>
          ) : filteredContacts.length === 0 ? (
            <div className="rounded-xl bg-slate-700 px-4 py-6 text-center text-sm text-slate-300 shadow-sm">
              No contacts found
            </div>
          ) : (
            filteredContacts.map((contact) => {
              const isActive = contact.id === activeContactId
              const initials = contact.avatar?.slice(0, 2).toUpperCase() || '??'
              return (
                <button
                  key={contact.id}
                  onClick={() => setActiveContactId(contact.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition cursor-pointer ${
                    isActive 
                      ? 'bg-slate-700 shadow ring-1 ring-emerald-500/30' 
                      : 'bg-slate-700/50 hover:bg-slate-700'
                  }`}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-emerald-600 text-white text-sm font-semibold">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-1">
                      <p className="truncate text-sm font-semibold text-slate-100">{contact.name}</p>
                      {contact.assignedAgent ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold border border-emerald-500/30 w-fit">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          {contact.assignedAgent}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-600/50 text-slate-400 text-[10px] font-medium border border-slate-500/50 w-fit">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
                          Unassigned
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-400 mt-0.5">
                      {contact.lastMessage || 'No recent activity'}
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 shrink-0">
                    {formatTime(contact.lastMessageTime)}
                  </span>
                </button>
              )
            })
          )}
        </div>
      </aside>

      <section className="flex min-h-0 flex-1 flex-col bg-linear-to-br from-slate-900 via-slate-800 to-slate-900">
        {!activeContact ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
            Select a contact to view messages
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 border-b border-slate-700 bg-slate-800/50 px-6 h-[72px]">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-linear-to-br from-emerald-400 to-emerald-600 text-white text-sm font-semibold shadow-sm">
                  {activeContact.avatar?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-slate-100">{activeContact.name}</p>
                  <p className="truncate text-xs text-slate-400">
                    Last active {formatTime(activeContact.lastMessageTime) || 'Recently'}
                  </p>
                </div>
              </div>
              <div className="shrink-0">
                {activeContact.assignedAgent ? (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned to</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-semibold border border-emerald-500/30 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                      {activeContact.assignedAgent}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned to</span>
                    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-slate-400 text-xs font-medium border border-slate-600 shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-slate-500"></span>
                      Unassigned
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div 
              className="flex-1 overflow-y-auto px-6 py-6 relative"
              style={{
                background: "url('https://raw.githubusercontent.com/jazimabbas/whatsapp-web-ui/refs/heads/master/public/assets/images/bg-chat-room.png')",
                backgroundSize: "430px 780px",
                backgroundRepeat: "repeat",
              }}
            >
              <div className="relative z-10 h-full">
              {messagesLoading ? (
                <div className="flex h-full items-center justify-center">
                  <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-emerald-500 rounded-full" role="status" aria-label="loading">
                    <span className="sr-only">Loading...</span>
                  </div>
                </div>
              ) : messagesError ? (
                <div className="flex h-full items-center justify-center text-sm text-rose-400">
                  {messagesError}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-slate-400">
                  No messages yet for this contact
                </div>
              ) : (
                <div className="mx-auto flex h-full w-full max-w-2xl flex-col gap-3">
                  {messages.map((message) => {
                    const isCompany = (message.senderType || 'customer') === 'company'
                    const hasMedia = message.mediaType && message.mediaType !== 'none'
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isCompany ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[70%] rounded-3xl px-4 py-3 text-sm shadow ${
                            isCompany
                              ? 'rounded-tr-sm bg-emerald-500 text-white shadow-emerald-500/25'
                              : 'rounded-tl-sm bg-slate-700 text-slate-100 shadow-slate-900/50 border border-slate-600'
                          }`}
                        >
                          {hasMedia && (
                            <MessageWithMedia
                              message={message}
                              mediaCacheRef={mediaCacheRef}
                            />
                          )}
                          {message.message && (
                            <p className="whitespace-pre-wrap wrap-break-word">{message.message}</p>
                          )}
                          {message.timestamp && (
                            <p className={`mt-2 text-[10px] font-medium text-right ${
                              isCompany ? 'opacity-70' : 'text-slate-400'
                            }`}>
                              {formatTime(message.timestamp)}
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  <div ref={messageEndRef} />
                </div>
              )}
              </div>
            </div>

            <div className="border-t border-slate-700 bg-slate-800/30 backdrop-blur-sm px-6 py-4 space-y-3">
              {/* Media Preview */}
              {selectedMedia && (
                <div className="relative rounded-xl border border-slate-600 bg-slate-700/50 p-3">
                  <button
                    onClick={handleRemoveMedia}
                    className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors z-10"
                    title="Remove media"
                  >
                    <X size={16} />
                  </button>
                  <div className="flex items-center gap-3">
                    {mediaPreview ? (
                      <>
                        {getMediaType(selectedMedia.type) === 'image' && (
                          <img
                            src={mediaPreview}
                            alt="Preview"
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        )}
                        {getMediaType(selectedMedia.type) === 'video' && (
                          <video
                            src={mediaPreview}
                            className="w-20 h-20 object-cover rounded-lg"
                            muted
                          />
                        )}
                      </>
                    ) : (
                      <div className="w-20 h-20 flex items-center justify-center rounded-lg bg-slate-600">
                        <Paperclip size={24} className="text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-100 truncate">
                        {selectedMedia.name}
                      </p>
                      <p className="text-xs text-slate-400">
                        {(selectedMedia.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Input Area */}
              <div className="flex items-center gap-2 rounded-2xl border border-slate-600/50 bg-slate-800/40 backdrop-blur-sm px-4 py-2.5 shadow-sm overflow-hidden">
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleMediaSelect}
                  accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.mov,.avi,.webm,.mp3,.wav,.ogg,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
                  className="hidden"
                  disabled={!activeContactId || uploading}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!activeContactId || uploading}
                  className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                  title="Attach media"
                >
                  <Paperclip size={20} />
                </button>
                <button
                  onClick={() => setShowTemplatePopup(true)}
                  disabled={!activeContactId}
                  className="p-2 rounded-lg text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:bg-transparent"
                  title="Templates"
                >
                  <FileText size={20} />
                </button>
                <input
                  value={messageInput}
                  onChange={(event) => setMessageInput(event.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && activeContactId) {
                      if (selectedMedia) {
                        handleMediaUpload()
                      } else if (messageInput.trim()) {
                        handleSend()
                      }
                    }
                  }}
                  type="text"
                  placeholder={selectedMedia ? "Add a caption (optional)..." : "Type a message…"}
                  className="flex-1 bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
                  disabled={!activeContactId || uploading}
                />
                <button
                  onClick={selectedMedia ? handleMediaUpload : handleSend}
                  disabled={uploading || !activeContactId || (!selectedMedia && !messageInput.trim())}
                  className={`rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all duration-500 ease-out hover:bg-emerald-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${
                    (messageInput.trim() || selectedMedia) && activeContactId
                      ? 'translate-x-0 opacity-100'
                      : 'translate-x-[200%] opacity-0 pointer-events-none'
                  }`}
                >
                  {uploading ? (
                    <div className="animate-spin inline-block size-4 border-2 border-current border-t-transparent rounded-full" />
                  ) : (
                    'Send'
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </section>
      
      <TemplatePopup
        isOpen={showTemplatePopup}
        onClose={() => setShowTemplatePopup(false)}
        onSelectTemplate={handleTemplateSelect}
        activeContactId={activeContactId}
      />
    </div>
  )
}

