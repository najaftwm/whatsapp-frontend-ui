// src/App.jsx
import React, { useState, useEffect } from 'react'
import { BarChart3, MessageCircle } from 'lucide-react'
import ChatList from './components/ChatList'
import ChatWindow from './components/ChatWindow'
import Login from './components/Login'
import { authClient } from './authClient'
import { API_BASE_URL, AUTH_HEADERS } from './config/api'
// Import Admin Panel components
import AdminSidebar from './components/admin/Sidebar'
import AdminChatSection from './components/admin/ChatSection'
import AdminContactsSection from './components/admin/ContactsSection'
import AdminCRMSettingsSection from './components/admin/CRMSettingsSection'

// Agent loading screen (WhatsApp style with Lucide icons)
const AgentLoaderScreen = () => (
  <div className="flex h-screen items-center justify-center bg-[#0b141a] text-center">
    <div className="flex flex-col items-center gap-6">
      <div className="relative overflow-hidden rounded-3xl">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-[#00a884]/20 border border-[#00a884]/30 shadow-lg relative z-10">
          <img
            src="/whatsapp-seeklogo.png"
            alt="WhatsApp"
            className="h-12 w-12 opacity-100"
          />
        </div>
        <div className="absolute inset-0 rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-[#00a884]/60 to-transparent animate-[shimmer_2s_ease-in-out_infinite] transform -skew-x-12"></div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <div className="text-xl font-semibold text-[#e9edef] tracking-wide">WhatsApp</div>
        <div className="text-sm text-[#8696a0]">Connecting to your chats...</div>
      </div>
      <div className="w-52 h-1.5 bg-[#1f2c34] rounded-full overflow-hidden">
        <div className="loader-bar h-full bg-linear-to-r from-[#00a884] to-[#00d9bb]" />
      </div>
      <div className="flex items-center gap-2">
        <div className="animate-spin inline-block size-4 border-2 border-current border-t-transparent text-[#00a884] rounded-full" role="status" aria-label="loading">
          <span className="sr-only">Loading...</span>
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
            className="text-[#8696a0]"
          >
            <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span>End-to-end encrypted</span>
        </div>
      </div>
    </div>
    <style>{`
      @keyframes shimmer {
        0% {
          transform: translateX(-150%) skewX(-12deg);
        }
        100% {
          transform: translateX(150%) skewX(-12deg);
        }
      }
    `}</style>
  </div>
)

// Admin loading screen
const AdminLoaderScreen = () => (
  <div className="flex h-screen items-center justify-center bg-slate-900 text-center">
    <div className="flex flex-col items-center gap-6">
      <div className="relative overflow-hidden rounded-3xl">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-emerald-500/20 border border-emerald-500/30 shadow-lg relative z-10">
          <BarChart3 className="text-emerald-400" size={40} />
        </div>
        <div className="absolute inset-0 rounded-3xl overflow-hidden">
          <div className="absolute inset-0 bg-linear-to-r from-transparent via-emerald-400/60 to-transparent animate-[shimmer_2s_ease-in-out_infinite] transform -skew-x-12"></div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400 font-semibold">
          TNS
        </p>
        <h1 className="text-2xl font-semibold text-slate-100">Admin Panel</h1>
      </div>
      <div className="w-52 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div className="loader-bar h-full bg-linear-to-r from-emerald-500 to-emerald-400" />
      </div>
      <div className="flex items-center gap-2">
        <div className="animate-spin inline-block size-4 border-2 border-current border-t-transparent text-emerald-500 rounded-full" role="status" aria-label="loading">
          <span className="sr-only">Loading...</span>
        </div>
        <div className="text-sm text-slate-400">Loading dashboard...</div>
      </div>
    </div>
    <style>{`
      @keyframes shimmer {
        0% {
          transform: translateX(-150%) skewX(-12deg);
        }
        100% {
          transform: translateX(150%) skewX(-12deg);
        }
      }
    `}</style>
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
              `${API_BASE_URL}/getContacts.php`,
              {
                method: "GET",
                credentials: "include",
                headers: AUTH_HEADERS,
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
          `${API_BASE_URL}/getContacts.php`,
          {
            method: "GET",
            credentials: "include", // This sends the session cookie
            headers: AUTH_HEADERS,
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
    // Try to get user type from stored user to show correct loader
    const storedUser = authClient.getUser()
    const detectedType = userType || storedUser?.type || storedUser?.user_type || storedUser?.userType
    
    // Show admin loader for admin users, agent loader for agent users
    if (detectedType === 'admin') {
      return <AdminLoaderScreen />
    }
    return <AgentLoaderScreen />
  }

  // Render Admin Panel if user is admin
  if (userType === 'admin') {
    return (
      <div className="flex h-screen bg-[#0d1117] text-white overflow-hidden">
        <AdminSidebar active={adminActiveSection} setActive={setAdminActiveSection} onLogout={handleLogout} />
        <div className="flex-1 flex flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">
            <div className="h-full w-full flex flex-col">
              <div className="flex-1 min-h-0">
                {adminActiveSection === 'dashboard' && (
                  <div className="flex h-full flex-col bg-[#0d1117]">
                    <header className="border-b border-white/10 px-8 py-6 bg-[#0f141a]/80 backdrop-blur-md">
                      <h2 className="text-xl font-semibold text-white">Dashboard</h2>
                      <p className="text-sm text-white/60">Overview of your workspace activity and metrics.</p>
                    </header>
                    <div className="flex flex-1 items-center justify-center px-6">
                      <div className="text-center max-w-md">
                        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-900/40 border border-emerald-800/30 shadow-lg shadow-emerald-900/30">
                          <BarChart3 className="text-emerald-400" size={32} />
                        </div>
                        <p className="text-lg font-semibold mb-2 text-white">Welcome to Dashboard</p>
                        <p className="text-sm text-white/60">Select a section from the sidebar to get started</p>
                      </div>
                    </div>
                  </div>
                )}
                {adminActiveSection === 'chat' && <AdminChatSection />}
                {adminActiveSection === 'contacts' && (
                  <AdminContactsSection onNavigateToSection={setAdminActiveSection} />
                )}
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
