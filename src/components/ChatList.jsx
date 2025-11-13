import React, { useMemo, useState, useEffect, useRef } from "react";
import { MoreVertical, Search, LogOut, Settings } from "lucide-react";

const normalizeContacts = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((c) => {
    const name = c.name || c.phone_number || "Unknown";
    const lastMessage = c.lastMessage ?? c.last_message ?? "";
    const lastMessageTime =
      c.lastMessageTime ??
      c.last_message_time ??
      c.last_seen ??
      c.time ??
      "";

    return {
      ...c,
      id: c.id,
      name,
      lastMessage,
      lastMessageTime,
      avatar: c.avatar || name.slice(0, 2).toUpperCase(),
    };
  });
};

const formatTime = (raw) => {
  if (!raw) return "";

  const tryDate = (value) => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  };

  let date = null;

  if (typeof raw === "number") {
    const t = raw < 1e12 ? raw * 1000 : raw;
    date = tryDate(t);
  } else if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return "";
    let isoLike = null;
    if (/^\d+$/.test(trimmed)) {
      const numeric = Number(trimmed);
      const factor = trimmed.length === 10 ? 1000 : 1;
      date = tryDate(numeric * factor);
    }
    if (!date) {
      isoLike = trimmed.replace(" ", "T");
      const isoPattern =
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?$/;
      if (isoPattern.test(isoLike)) {
        date = tryDate(`${isoLike}Z`);
        if (!date) {
          date = tryDate(isoLike);
        }
      }
    }
    if (!date) {
      date = tryDate(trimmed);
      if (!date && isoLike) {
        date = tryDate(`${isoLike}Z`);
      }
    }
  }

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

export default function ChatList({ chats, activeId, onSelect, onLogout }) {
  const [query, setQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [contacts, setContacts] = useState(() => normalizeContacts(chats));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
          "https://unimpaired-overfrugal-milda.ngrok-free.dev/backendfrontend/BACKENDPHP/api/getContacts.php",
          {
            method: "GET",
            credentials: "include", // This sends the session cookie
            headers: { "Content-Type": "application/json", "Authorization": "Bearer q6ktqrPs3wZ4kvZAzNdi7" },
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
        const mapped = normalizeContacts(data.contacts);
        console.log('ChatList - Normalized contacts:', mapped.length, 'contacts');
        setContacts(mapped);
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
        <div className="w-11 h-11 rounded-full overflow-hidden cursor-pointer">
          <img
            src="https://imgs.search.brave.com/yyohYnmzAAnkfFJW05xsD3s5CgX2w39fc_AGW-kFWFo/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly90My5m/dGNkbi5uZXQvanBn/LzEyLzgxLzEyLzE2/LzM2MF9GXzEyODEx/MjE2NjNfSmV4eXJI/ckFCZUhjOEl0Q3lG/Qk1DR2hqZVBRekxV/QlYuanBn"
            alt="Profile"
            className="w-full h-full object-cover"
          />
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
          <div className="p-4 text-center text-gray-400">
            Loading contacts...
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
                      <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                        {formatTime(c.lastMessageTime)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 truncate leading-5">
                      {c.lastMessage}
                    </p>
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
