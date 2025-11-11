// src/App.jsx
import React, { useState, useEffect } from 'react'
import ChatList from './components/ChatList'
import ChatWindow from './components/ChatWindow'
import Login from './components/Login'
import { authClient } from './authClient'

const LoaderScreen = () => (
  <div className="flex h-screen items-center justify-center bg-[#0b141a] text-center">
    <div className="flex flex-col items-center gap-6 text-[#e9edef]">
      <img
        src="/whatsapp-seeklogo.png"
        alt="WhatsApp"
        className="h-20 w-20 opacity-100"
      />
      <div className="text-lg font-medium tracking-wide">WhatsApp</div>
      <div className="w-52 h-1.5 bg-[#1f2c34] rounded-full overflow-hidden">
        <div className="loader-bar h-full bg-[#00a884]" />
      </div>
      <div className="text-sm text-[#8696a0] flex items-center gap-2">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        End-to-end encrypted
      </div>
    </div>
  </div>
)

export default function App() {
  const [activeChatId, setActiveChatId] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isAuthed, setIsAuthed] = useState(authClient.isAuthenticated())
  const [contacts, setContacts] = useState([])
  const [showLoader, setShowLoader] = useState(isAuthed)

  // Fetch contacts when authenticated
  useEffect(() => {
    if (!isAuthed) return;
    async function fetchContacts() {
      try {
        const resp = await fetch(
          "https://wapi.twmresearchalert.com/backendphp/api/getContacts.php",
          {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json", "Authorization": "Bearer q6ktqrPs3wZ4kvZAzNdi7" },
          }
        );
        const data = await resp.json();
        if (data?.ok && data.contacts) {
          // Map contacts to match ChatList format
          const mapped = data.contacts.map((c) => ({
            id: c.id,
            name: c.name || c.phone_number || "Unknown",
            phone_number: c.phone_number,
            last_message: c.last_message || "",
            last_message_time: c.last_message_time || c.last_seen || "",
            last_seen: c.last_seen || "",
            avatar: (c.name || c.phone_number || "?").slice(0, 2).toUpperCase(),
          }));
          setContacts(mapped);
        }
      } catch (e) {
        console.error("Failed to load contacts:", e);
      }
    }
    fetchContacts();
  }, [isAuthed]);

  useEffect(() => {
    if (isAuthed) {
      setShowLoader(true)
      const timer = setTimeout(() => setShowLoader(false), 2000)
      return () => clearTimeout(timer)
    }
    setShowLoader(false)
  }, [isAuthed])

  function handleLogout() {
    authClient.logout()
    setIsAuthed(false)
  }

  function handleCloseChat() {
    setActiveChatId(null)
    setMobileOpen(false)
  }

  useEffect(() => {
    // keep auth state in sync if storage changes in other tabs
    function onStorage(e) {
      if (e.key === 'isAuthenticated') {
        setIsAuthed(authClient.isAuthenticated())
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Find active chat info from contacts
  const activeChat = activeChatId ? contacts.find(c => c.id === activeChatId) : null

  function handleSelect(chatId) {
    setActiveChatId(chatId)
    // if on mobile, open the chat window panel
    setMobileOpen(true)
  }

  function handleLoginSuccess() {
    setIsAuthed(true)
  }

  if (!isAuthed) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  if (showLoader) {
    return <LoaderScreen />
  }

  return (
    <div className="min-h-screen bg-(--color-chatBg) flex items-center justify-center">
      <div className="hidden md:flex w-full max-w-[1600px]">
        {/* Left column: Chat list */}
        <div
          className="w-[30%] bg-[#111b21] border-r border-[#2a3942]"
        >
          <div className="h-screen max-h-screen">
            <ChatList chats={contacts} activeId={activeChatId} onSelect={handleSelect} onLogout={handleLogout} />
          </div>
        </div>
        {/* Right column: Chat window */}
        <div className="w-[70%]">
          <div className="h-screen max-h-screen wa-wallpaper">
            {activeChatId ? (
              <ChatWindow
                activeChat={activeChatId}
                contact={activeChat}
                onCloseChat={handleCloseChat}
              />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-5 bg-[#0b141a] text-center text-[#e9edef] px-6">
                <img
                  src="/whatsapp-seeklogo.png"
                  alt="WhatsApp"
                  className="h-20 w-20 opacity-80"
                />
                <p className="text-sm text-[#8696a0] flex items-center gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Your personal messages are end-to-end encrypted
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile layout */}
      <div className="w-full md:hidden">
        {!mobileOpen && (
          <div className="h-screen bg-[#111b21] overflow-hidden">
            <ChatList chats={contacts} activeId={activeChatId} onSelect={handleSelect} onLogout={handleLogout} />
          </div>
        )}

        {mobileOpen && (
          <div className="fixed inset-0 z-40 bg-(--color-chatBg) wa-wallpaper">
            {activeChatId ? (
              <ChatWindow
                activeChat={activeChatId}
                contact={activeChat}
                onBack={() => setMobileOpen(false)}
                onCloseChat={handleCloseChat}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-textSecondary">
                Select a contact to start chatting
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
