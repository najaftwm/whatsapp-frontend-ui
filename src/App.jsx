// src/App.jsx
import React, { useState, useEffect } from 'react'
import ChatList from './components/ChatList'
import ChatWindow from './components/ChatWindow'
import Login from './components/Login'
import { authClient } from './authClient'
// Import Admin Panel components
import AdminSidebar from './components/admin/Sidebar'
import AdminChatSection from './components/admin/ChatSection'
import AdminContactsSection from './components/admin/ContactsSection'
import AdminCRMSettingsSection from './components/admin/CRMSettingsSection'

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
  const [userType, setUserType] = useState(null) // 'admin' or 'agent'
  const [loadingUserType, setLoadingUserType] = useState(true)
  const [adminActiveSection, setAdminActiveSection] = useState('chat') // For admin panel navigation

  // Fetch user type after authentication
  useEffect(() => {
    if (!isAuthed) {
      setUserType(null)
      setLoadingUserType(false)
      return
    }

    async function fetchUserType() {
      setLoadingUserType(true)
      try {
        // Method 1: Try to get user type from stored user (from login response)
        const storedUser = authClient.getUser()
        console.log('Stored user from localStorage:', storedUser)
        let type = storedUser?.type || storedUser?.user_type || storedUser?.userType
        
        // Method 2: If not found, try to fetch from backend getCurrentUser endpoint
        if (!type) {
          try {
            const user = await authClient.getCurrentUser()
            type = user?.type || user?.user_type || user?.userType
            console.log('User type from getCurrentUser:', type)
          } catch {
            console.log('getCurrentUser endpoint not available, trying alternative method')
          }
        }
        
        // Method 3: Infer from getContacts response
        // Backend returns different data for admin vs agent
        // Admin: all contacts, Agent: only assigned contacts
        // We can check if we get contacts that might indicate admin
        if (!type) {
          try {
            const resp = await fetch(
              "https://unimpaired-overfrugal-milda.ngrok-free.dev/backendfrontend/BACKENDPHP/api/getContacts.php",
              {
                method: "GET",
                credentials: "include",
                headers: { "Content-Type": "application/json", "Authorization": "Bearer q6ktqrPs3wZ4kvZAzNdi7" },
              }
            )
            const data = await resp.json()
            console.log('getContacts response for user type detection:', data)
            
            // This is a fallback - not ideal but works if backend doesn't return user type
            // Default to 'agent' - the backend will filter contacts correctly anyway
            type = 'agent'
          } catch (e) {
            console.error('Failed to fetch contacts for user type detection:', e)
            type = 'agent'
          }
        }
        
        console.log('Final determined user type:', type)
        setUserType(type || 'agent')
      } catch (error) {
        console.error('Failed to fetch user type:', error)
        setUserType('agent') // Default to agent on error
      } finally {
        setLoadingUserType(false)
      }
    }

    fetchUserType()
  }, [isAuthed])

  // Fetch contacts when authenticated (only for agents)
  useEffect(() => {
    if (!isAuthed || userType !== 'agent') {
      console.log('App.jsx - Skipping contacts fetch:', { isAuthed, userType });
      return;
    }
    
    async function fetchContacts() {
      console.log('App.jsx - Fetching contacts for agent...');
      try {
        const resp = await fetch(
          "https://unimpaired-overfrugal-milda.ngrok-free.dev/backendfrontend/BACKENDPHP/api/getContacts.php",
          {
            method: "GET",
            credentials: "include", // This sends the session cookie
            headers: { "Content-Type": "application/json", "Authorization": "Bearer q6ktqrPs3wZ4kvZAzNdi7" },
          }
        );
        const data = await resp.json();
        console.log('App.jsx - getContacts response:', {
          status: resp.status,
          ok: data?.ok,
          contactCount: data?.contacts?.length || 0,
          allContactIds: data?.contacts?.map(c => ({ id: c.id, name: c.name })),
          sampleContact: data?.contacts?.[0],
        });
        
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
          console.log('App.jsx - Mapped contacts:', mapped.length, 'contacts');
          setContacts(mapped);
        } else {
          console.error('App.jsx - getContacts failed:', data);
        }
      } catch (e) {
        console.error("App.jsx - Failed to load contacts:", e);
      }
    }
    fetchContacts();
  }, [isAuthed, userType]);

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

  function handleLoginSuccess(user) {
    setIsAuthed(true)
    // Try to get user type from login response
    if (user) {
      const type = user?.type || user?.user_type || user?.userType
      if (type) {
        setUserType(type)
        setLoadingUserType(false)
      }
    }
  }

  if (!isAuthed) {
    return <Login onLoginSuccess={handleLoginSuccess} />
  }

  if (showLoader || loadingUserType) {
    return <LoaderScreen />
  }

  // Render Admin Panel if user is admin
  if (userType === 'admin') {
    return (
      <div className="flex h-screen bg-(--surface-subtle) text-slate-900">
        <AdminSidebar active={adminActiveSection} setActive={setAdminActiveSection} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="h-20 border-b border-slate-200 bg-white/95 backdrop-blur">
            <div className="h-full px-6 flex items-center justify-between">
              <h1 className="text-xl font-semibold tracking-tight">
                {adminActiveSection === 'chat' && 'Live Chats'}
                {adminActiveSection === 'contacts' && 'Contacts'}
                {adminActiveSection === 'crm' && 'CRM Settings'}
              </h1>
              <div className="flex items-center gap-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-500">
                  TNS <span className="text-xs tracking-[0.18em] text-emerald-500">Admin</span>
                </p>
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-semibold text-red-600 hover:text-red-700 transition"
                >
                  Logout
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-hidden bg-white">
            <div className="h-full w-full flex flex-col">
              <div className="flex-1 min-h-0">
                {adminActiveSection === 'chat' && <AdminChatSection />}
                {adminActiveSection === 'contacts' && <AdminContactsSection />}
                {adminActiveSection === 'crm' && <AdminCRMSettingsSection />}
              </div>
            </div>
          </main>
        </div>
      </div>
    )
  }

  // Render Chat Interface for agents
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
