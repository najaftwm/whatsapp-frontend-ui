import React, { useMemo, useState, useEffect, useRef } from "react";
import { MoreVertical, Search, LogOut, Settings } from "lucide-react";
import { API_BASE_URL, AUTH_HEADERS } from "../config/api";
import { authClient } from "../authClient";

const normalizeContacts = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((c) => {
    const name = c.name || c.phone_number || "Unknown";
    const lastMessage = c.lastMessage ?? c.last_message ?? "";
    // Prioritize last_message_time over last_seen for accurate last message time
    const lastMessageTime =
      c.last_message_time ??
      c.lastMessageTime ??
      c.time ??
      null; // Don't use last_seen as it's not the message time

    return {
      ...c,
      id: c.id,
      name,
      lastMessage,
      lastMessageTime: lastMessageTime || null,
      avatar: c.avatar || name.slice(0, 2).toUpperCase(),
    };
  });
};

const parseTimestamp = (raw) => {
  if (!raw) return null;
  
  const toDate = (value) => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  let date = null;
  
  if (typeof raw === "number") {
    const ms = raw < 1e12 ? raw * 1000 : raw;
    date = toDate(ms);
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    
    // Handle numeric strings (Unix timestamps)
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      date = toDate(trimmed.length === 10 ? numeric * 1000 : numeric);
    }
    
    // Handle datetime strings like "2024-01-15 15:42:00" or "2024-01-15T15:42:00"
    if (!date) {
      // Replace space with T for ISO-like format
      let isoLike = trimmed.replace(" ", "T");
      
      // Check if it's a datetime string without timezone (e.g., "2024-01-15T15:42:00")
      const datetimePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?(?:\.(\d+))?$/;
      const match = isoLike.match(datetimePattern);
      
      if (match) {
        // Parse as local time by creating Date object with individual components
        // This ensures it's treated as local time, not UTC
        const year = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // Month is 0-indexed
        const day = parseInt(match[3], 10);
        const hour = parseInt(match[4], 10);
        const minute = parseInt(match[5], 10);
        const second = match[6] ? parseInt(match[6], 10) : 0;
        const millisecond = match[7] ? parseInt(match[7].substring(0, 3), 10) : 0;
        
        date = new Date(year, month, day, hour, minute, second, millisecond);
        if (Number.isNaN(date.getTime())) {
          date = null;
        }
      }
      
      // If still no date, try standard parsing
      if (!date) {
        // Try as-is first (might be ISO with timezone)
        date = toDate(trimmed);
        if (!date) {
          // Try with T replacement
          date = toDate(isoLike);
          if (!date) {
            // Try with Z suffix (UTC)
            date = toDate(`${isoLike}Z`);
          }
        }
      }
    }
  }

  return date;
};

const formatTime = (raw) => {
  const date = parseTimestamp(raw);
  if (!date) return "";

  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(date);
  } catch {
    return "";
  }
};

const formatDateOnly = (raw) => {
  const date = parseTimestamp(raw);
  if (!date) return "";

  try {
    // Only return the date, no time
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: undefined, // Use local timezone
    });
  } catch (e) {
    console.error("Error formatting date:", e, raw);
    return "";
  }
};

export default function ChatList({ chats, activeId, onSelect, onLogout }) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [contacts, setContacts] = useState(() => normalizeContacts(chats));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [user, setUser] = useState(null);

  // Get logged-in user info
  useEffect(() => {
    async function fetchUser() {
      try {
        // Try to get fresh user data from API
        const currentUser = await authClient.getCurrentUser();
        setUser(currentUser);
      } catch (error) {
        // Fallback to stored user data
        const storedUser = authClient.getUser();
        setUser(storedUser);
      }
    }
    fetchUser();
  }, []);

  useEffect(() => {
    setContacts(normalizeContacts(chats));
  }, [chats]);

  useEffect(() => {
    let aborted = false;
    async function fetchContacts() {
      setLoading(true);
      setError("");
      console.log('ChatList - Fetching contacts (this should only show assigned contacts for agents)...');
      try {
        const resp = await fetch(
          `${API_BASE_URL}/getContacts.php`,
          {
            method: "GET",
            credentials: "include", // This sends the session cookie
            headers: AUTH_HEADERS,
          }
        );
        const data = await resp.json().catch(() => ({}));
        console.log('ChatList - getContacts response:', {
          status: resp.status,
          ok: data?.ok,
          contactCount: data?.contacts?.length || 0,
          allContacts: data?.contacts?.map(c => ({ id: c.id, name: c.name, agent_id: c.agent_id, agent_name: c.agent_name })),
        });
        
        if (!resp.ok || data?.ok !== true) {
          throw new Error(data?.error || "Failed to load contacts");
        }
        if (aborted) return;
        let mapped = normalizeContacts(data.contacts);
        
        // Fetch the last message timestamp for ALL contacts to ensure accuracy
        // This ensures we always have the most recent timestamp from actual messages
        if (mapped.length > 0 && !aborted) {
          const timePromises = mapped.map(async (contact) => {
            try {
              const msgResp = await fetch(
                `${API_BASE_URL}/getMessages.php?contact_id=${encodeURIComponent(contact.id)}`,
                {
                  credentials: "include",
                  headers: AUTH_HEADERS,
                }
              );
              const msgData = await msgResp.json().catch(() => ({}));
              if (msgData?.ok && msgData?.messages && Array.isArray(msgData.messages) && msgData.messages.length > 0) {
                // Get the most recent message timestamp
                const sortedMessages = [...msgData.messages].sort((a, b) => {
                  const timeA = new Date(a.timestamp || a.time || 0).getTime();
                  const timeB = new Date(b.timestamp || b.time || 0).getTime();
                  return timeB - timeA;
                });
                const latestTimestamp = sortedMessages[0]?.timestamp || sortedMessages[0]?.time || null;
                if (latestTimestamp) {
                  console.log(`Fetched timestamp for contact ${contact.id}:`, latestTimestamp);
                  return {
                    id: contact.id,
                    lastMessageTime: latestTimestamp,
                  };
                }
              }
            } catch (e) {
              console.error(`Failed to fetch last message for contact ${contact.id}:`, e);
            }
            return null;
          });
          
          const timeResults = await Promise.all(timePromises);
          // Update contacts with fetched timestamps (only if we got a valid timestamp)
          mapped = mapped.map(contact => {
            const timeResult = timeResults.find(r => r && r.id === contact.id);
            if (timeResult && timeResult.lastMessageTime) {
              // Always use the fetched timestamp from actual messages for accuracy
              console.log(`Updating contact ${contact.id} (${contact.name}) with timestamp:`, timeResult.lastMessageTime);
              return { ...contact, lastMessageTime: timeResult.lastMessageTime };
            }
            // If we couldn't fetch a timestamp, keep the existing one
            return contact;
          });
        }
        
        console.log('ChatList - Normalized contacts:', mapped.length, 'contacts');
        if (!aborted) {
          setContacts(mapped);
        }
      } catch (e) {
        console.error('ChatList - Error fetching contacts:', e);
        if (!aborted) setError(e?.message || "Failed to load contacts");
      } finally {
        if (!aborted) setLoading(false);
      }
    }
    fetchContacts();
    return () => {
      aborted = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const fallback = normalizeContacts(chats);
    const list = contacts && contacts.length ? contacts : fallback;
    if (!q) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.lastMessage || "").toLowerCase().includes(q)
    );
  }, [contacts, chats, query]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    if (menuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [menuOpen]);

  const handleLogout = () => {
    if (typeof onLogout === "function") onLogout();
    setMenuOpen(false);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#111b21] border-r border-[#2a2f32]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#202c33] border-b border-[#2a2f32] h-[72px]">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="w-11 h-11 rounded-full overflow-hidden cursor-pointer shrink-0">
            <img
              src="/profile-picture.png"
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-[15px] font-medium text-white truncate">
              {user?.name || user?.full_name || user?.agent_name || user?.username || user?.email || "Agent"}
            </h3>
            <p className="text-xs text-[#8696a0] truncate">
              {user?.email || "Online"}
            </p>
          </div>
        </div>

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-2 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2a3942] rounded-full transition-colors cursor-pointer"
          >
            <MoreVertical size={20} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-[#233138] rounded-md shadow-lg z-50 py-1">
              <button
                onClick={() => setMenuOpen(false)}
                className="flex items-center px-4 py-3 text-[#e9edef] hover:bg-[#2a3942] transition-colors w-full text-left text-sm cursor-pointer"
              >
                <Settings size={16} className="mr-3" />
                Settings
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center px-4 py-3 text-[#e9edef] hover:bg-[#2a3942] transition-colors w-full text-left text-sm cursor-pointer"
              >
                <LogOut size={16} className="mr-3" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="p-3 pb-0 bg-[#111b21]">
        <div className="relative">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-500 dark:text-gray-400" />
          </div>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            type="text"
            placeholder="Search or start new chat"
            className="w-full py-2.5 pl-12 pr-4 rounded-xl text-[15px] bg-[#202c33] text-white placeholder-gray-400 border border-transparent focus:outline-none focus:border-[#00a884] focus:ring-1 focus:ring-[#00a884]"
          />
        </div>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-[#2a3942] scrollbar-track-transparent">
        {loading ? (
          <div className="flex items-center justify-center p-4">
            <div className="animate-spin inline-block size-6 border-[3px] border-current border-t-transparent text-[#00a884] rounded-full" role="status" aria-label="loading">
              <span className="sr-only">Loading...</span>
            </div>
          </div>
        ) : error ? (
          <div className="p-4 text-center text-red-400">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="p-4 text-center text-gray-400">
            No chats found
          </div>
        ) : (
          <div className="px-3 pt-2 pb-3 space-y-2.5">
            {filtered.map((c) => {
              const active = c.id === activeId;
              const avatarUrl =
                typeof c.avatar === "string" && c.avatar.startsWith("http")
                  ? c.avatar
                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(
                      c.name || "User"
                    )}&background=random`;

              return (
                <div
                  key={c.id}
                  onClick={() => onSelect(c.id)}
                  className={`flex items-center px-4 py-3.5 rounded-xl cursor-pointer transition-all duration-150 ${
                    active
                      ? "bg-[#2a3942] shadow-sm"
                      : "hover:bg-[#2a3942]"
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full overflow-hidden mr-3.5 shrink-0">
                    <img
                      src={avatarUrl}
                      alt={c.name}
                      className="w-full h-full object-cover"
                    />
                  </div>

                  {/* Chat info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className="text-[15px] font-medium text-white truncate">
                        {c.name || "Unknown"}
                      </h3>
                      {(() => {
                        // Only show date if we have lastMessageTime
                        if (!c.lastMessageTime) {
                          return null;
                        }
                        
                        // Parse the timestamp first
                        const parsedDate = parseTimestamp(c.lastMessageTime);
                        if (!parsedDate) {
                          return null;
                        }
                        
                        // Try formatDateOnly first
                        let formatted = formatDateOnly(c.lastMessageTime);
                        
                        // If that fails, use the parsed date directly
                        if (!formatted && parsedDate) {
                          try {
                            formatted = parsedDate.toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            });
                          } catch (e) {
                            console.error("Error formatting parsed date:", e, c.lastMessageTime);
                          }
                        }
                        
                        // Only show if we have a valid formatted date
                        if (formatted) {
                          return (
                            <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap ml-2">
                              {formatted}
                            </span>
                          );
                        }
                        
                        return null;
                      })()}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-gray-400 truncate leading-5 flex-1">
                        {c.lastMessage}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
