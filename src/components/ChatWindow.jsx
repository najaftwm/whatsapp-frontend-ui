import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Send,
  Mic,
  Smile,
  Paperclip,
  Search,
  MoreVertical,
  ArrowLeft,
  XCircle,
  X,
  FileText,
} from "lucide-react";
import { pusher } from "../pusherClient";
import { API_BASE_URL, AUTH_HEADERS } from "../config/api";
import MessageWithMedia from "./admin/MessageWithMedia";
import TemplatePopup from "./admin/TemplatePopup";

export default function ChatWindow({
  activeChat,
  messages,
  contact,
  onBack,
  onCloseChat,
}) {
  const [input, setInput] = useState("");
  const [chatMessages, setChatMessages] = useState(messages || []);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [mediaPreview, setMediaPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showTemplatePopup, setShowTemplatePopup] = useState(false);
  const mediaCacheRef = useRef(new Map());
  const endRef = useRef(null);
  const fileInputRef = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Fetch messages when chat changes
  useEffect(() => {
    async function fetchMessages() {
      if (!activeChat) {
        setChatMessages([]);
        return;
      }
      try {
        const res = await fetch(
          `${API_BASE_URL}/getMessages.php?contact_id=${activeChat}`,
          { credentials: "include" ,
          headers: AUTH_HEADERS,
        });
        const data = await res.json();
        if (data?.ok && data.messages) {
          // Map backend message format to frontend format
          const mapped = data.messages.map(m => ({
            id: m.id,
            message: m.message_text || '',
            sender_type: m.sender_type || 'customer',
            timestamp: m.timestamp,
            mediaType: m.media_type || null,
            mediaFilePath: m.media_file_path || null,
            mediaFileName: m.media_file_name || null,
          }));
          setChatMessages(mapped);
        }
      } catch (e) {
        console.error("Failed to load messages:", e);
        setChatMessages([]);
      }
    }
    fetchMessages();
  }, [activeChat]);

  // Real-time updates
  useEffect(() => {
    if (!activeChat) return;
    const channel = pusher.subscribe("chat-channel");
    channel.bind("new-message", (data) => {
      if (data.contact_id === activeChat) {
        // Generate unique ID if not provided
        const uniqueId = data.id || `pusher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setChatMessages((prev) => {
          const text = data.message || data.message_text || '';

          // If this is a company (outgoing) message, replace the last optimistic temp one
          if ((data.sender_type || 'customer') === 'company') {
            const lastIdx = [...prev].reverse().findIndex(m => {
              if (m.sender_type !== 'company') return false;
              const id = typeof m.id === 'string' ? m.id : '';
              return id.startsWith('temp-') && (m.message === text || m.isPending);
            });
            if (lastIdx !== -1) {
              const idx = prev.length - 1 - lastIdx;
              const next = [...prev];
              next[idx] = {
                id: uniqueId,
                message: text,
                sender_type: 'company',
                timestamp: data.timestamp || new Date().toISOString(),
                mediaType: data.media_type || next[idx].mediaType || null,
                mediaFilePath: data.media_file_path || next[idx].mediaFilePath || null,
                mediaFileName: data.media_file_name || next[idx].mediaFileName || null,
                isPending: false,
              };
              return next;
            }
          }

          // Otherwise, prevent exact duplicates
          const exists = prev.some(msg => msg.id === uniqueId || (msg.timestamp === data.timestamp && msg.message === text && msg.sender_type === (data.sender_type || 'customer')));
          if (exists) return prev;

          return [...prev, {
            id: uniqueId,
            message: text,
            sender_type: data.sender_type || 'customer',
            timestamp: data.timestamp || new Date().toISOString(),
            mediaType: data.media_type || null,
            mediaFilePath: data.media_file_path || null,
            mediaFileName: data.media_file_name || null,
          }];
        });
      }
    });
    return () => {
      pusher.unsubscribe("chat-channel");
    };
  }, [activeChat]);

  // Scroll to bottom
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  useEffect(() => {
    if (!menuOpen) return undefined;

    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  // Clear media when switching chats
  useEffect(() => {
    setSelectedMedia(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, [activeChat]);

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      mediaCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
      mediaCacheRef.current.clear();
    };
  }, []);

  const getMediaType = (mimeType) => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text') || mimeType.includes('zip')) return 'document';
    return 'document';
  };

  const handleMediaSelect = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB max)
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      alert('File size exceeds 50MB limit');
      return;
    }

    setSelectedMedia(file);

    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setMediaPreview(e.target.result);
    };

    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
      reader.readAsDataURL(file);
    } else {
      setMediaPreview(null);
    }
  };

  const handleMediaUpload = async () => {
    if (!selectedMedia || !activeChat || uploading) return;

    setUploading(true);

    const formData = new FormData();
    formData.append('media', selectedMedia);
    formData.append('contact_id', activeChat);
    if (input.trim()) {
      formData.append('message', input.trim());
    }

    const tempId = `temp-${Date.now()}`;
    const messageText = input.trim() || 'Media file';

    // Optimistic update
    setChatMessages((prev) => [
      ...prev,
      {
        id: tempId,
        message: messageText,
        sender_type: 'company',
        timestamp: new Date().toISOString(),
        mediaType: getMediaType(selectedMedia.type),
        mediaPreview: mediaPreview,
        isPending: true,
      },
    ]);

    setInput('');
    setSelectedMedia(null);
    setMediaPreview(null);

    try {
      const res = await fetch(`${API_BASE_URL}/uploadMedia.php`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          Authorization: AUTH_HEADERS.Authorization,
        },
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data?.ok !== true) {
        throw new Error(data?.error || 'Failed to upload media');
      }

      // Update message with server response
      setChatMessages((prev) =>
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
      );
    } catch (error) {
      console.error('Failed to upload media', error);
      // Remove failed message
      setChatMessages((prev) => prev.filter((msg) => msg.id !== tempId));
      alert(error?.message || 'Failed to upload media');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMedia = () => {
    setSelectedMedia(null);
    setMediaPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleTemplateSelect = (templateText) => {
    if (templateText && activeChat) {
      const messageText = templateText;
      setInput("");

      // Local optimistic update
      const tempId = `temp-${Date.now()}`;
      setChatMessages((prev) => [
        ...prev,
        { 
          id: tempId,
          message: messageText, 
          sender_type: "company",
          timestamp: new Date().toISOString()
        },
      ]);

      // Send to backend
      fetch(
        `${API_BASE_URL}/sendMessage.php`,
        {
          method: "POST",
          credentials: "include",
          headers: AUTH_HEADERS,
          body: JSON.stringify({
            contact_id: activeChat,
            message: messageText,
          }),
        }
      ).catch((e) => {
        console.error("Send failed:", e);
      });
    }
  };

  // Handle Send
  const handleSend = async () => {
    if (selectedMedia) {
      handleMediaUpload();
      return;
    }

    if (!input.trim()) return;

    const messageText = input.trim();
    setInput("");

    // Local optimistic update
    const tempId = `temp-${Date.now()}`;
    setChatMessages((prev) => [
      ...prev,
      { 
        id: tempId,
        message: messageText, 
        sender_type: "company",
        timestamp: new Date().toISOString()
      },
    ]);

    try {
      await fetch(
        `${API_BASE_URL}/sendMessage.php`,
        {
          method: "POST",
          credentials: "include",
          headers: AUTH_HEADERS,
          body: JSON.stringify({
            contact_id: activeChat,
            message: messageText,
          }),
        }
      );
    } catch (e) {
      console.error("Send failed:", e);
    }
  };

  const handleIconEnter = (event) => {
    event.currentTarget.style.backgroundColor = "rgba(255,255,255,0.1)";
    event.currentTarget.style.color = "#ffffff";
    event.currentTarget.style.borderRadius = "9999px";
  };

  const handleIconLeave = (event) => {
    event.currentTarget.style.backgroundColor = "transparent";
    event.currentTarget.style.color = "";
    event.currentTarget.style.borderRadius = "";
  };
  const handleCloseChat = () => {
    setMenuOpen(false);
    if (typeof onCloseChat === "function") {
      onCloseChat();
    }
  };


  const parseDate = useCallback((raw) => {
    if (!raw) return null;

    const tryDate = (value) => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    };

    let date = null;
    let isoLike = null;

    if (typeof raw === "number") {
      const t = raw < 1e12 ? raw * 1000 : raw;
      date = tryDate(t);
    } else if (typeof raw === "string") {
      const trimmed = raw.trim();
      if (!trimmed) return null;
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

    return date;
  }, []);

  const formatTime = useCallback((raw) => {
    const date = parseDate(raw);
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
  }, [parseDate]);

  const contactName = useMemo(() => {
    if (contact?.name) return contact.name;
    if (typeof activeChat === "string") return activeChat;
    if (typeof activeChat === "number") return `Contact ${activeChat}`;
    return "Conversation";
  }, [activeChat, contact]);

  const contactAvatar = useMemo(() => {
    if (contact?.avatar) return contact.avatar;
    const source = contact?.name || contact?.phone_number || `${contactName}`;
    if (!source) return "??";
    return source.slice(0, 2).toUpperCase();
  }, [contact, contactName]);

  const contactStatus = useMemo(() => {
    const raw =
      contact?.lastMessageTime ||
      contact?.last_message_time ||
      contact?.last_seen ||
      "";
    const date = parseDate(raw);
    if (!date) {
      return contact?.last_seen || contact?.phone_number || "Online";
    }

    const now = new Date();
    const sameDay = now.toDateString() === date.toDateString();
    const timeLabel = formatTime(raw);
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
    });

    if (sameDay) {
      return `Last message at ${timeLabel}`;
    }

    return `Last message ${dateFormatter.format(date)} ${timeLabel}`;
  }, [contact, formatTime, parseDate]);

  const showBackButton = typeof onBack === "function";

  if (!activeChat || !contact) {
    return (
      <div className="flex flex-col justify-center items-center h-full bg-[#0b141a] text-center p-5 border-b-[6px] border-[#00a884]">
        <div className="w-[550px] max-w-full mb-5">
          <img
            src="https://raw.githubusercontent.com/jazimabbas/whatsapp-web-ui/master/public/assets/images/entry-image-dark.png"
            alt="WhatsApp Web"
            className="w-full h-full rounded-full"
          />
        </div>
        <h1 className="text-[#0b141a] text-[2rem] font-normal mb-[10px] bg-white px-4 py-1 rounded-full">
          WhatsApp Web
        </h1>
        <p className="text-[#8696a0] text-[0.9rem] font-medium max-w-[500px] leading-6 flex flex-col items-center pb-[30px]">
          <span>Send and receive messages without keeping your phone online.</span>
          <span>Use WhatsApp on up to 4 linked devices and 1 phone at the same time.</span>
        </p>
        <p className="text-[#8696a0] text-[0.9rem] font-medium max-w-[500px] leading-6 flex items-center pt-[10px]">
          <span>Built by</span>
          <span className="px-2">Ashutosh Mishra</span>
          <span className="text-red-500 ml-[2px]">❤</span>
        </p>
      </div>
    );
  }

  const avatarUrl =
    (contact?.avatar && contact?.avatar.startsWith("http")
      ? contact.avatar
      : null) ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      contactName || "User"
    )}&background=random`;

  const wallpaperStyle = {
    background:
      "url('https://raw.githubusercontent.com/jazimabbas/whatsapp-web-ui/refs/heads/master/public/assets/images/bg-chat-room.png')",
    backgroundSize: "430px 780px",
    backgroundRepeat: "repeat",
  };

  return (
    <div className="flex flex-col h-full bg-[#0b141a]">
      {/* Chat header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[#202c33] border-l border-[#8696a026] h-[72px]">
        <div className="flex items-center flex-1 min-w-0 gap-3">
          {showBackButton && (
            <button
              type="button"
              onClick={onBack}
              className="text-[#8696a0] hover:text-white transition-colors p-2 -ml-2 mr-1 cursor-pointer"
              aria-label="Back"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="w-12 h-12 rounded-full overflow-hidden cursor-pointer bg-[#2a3942] flex items-center justify-center text-white text-base font-medium">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={contactName}
                className="w-full h-full object-cover"
              />
            ) : (
              contactAvatar
            )}
          </div>
          <div className="flex-1 cursor-pointer min-w-0">
            <h2 className="font-normal text-white text-[16px] leading-[21px] truncate">
              {contactName}
            </h2>
            <p className="text-xs text-[#8696a0] truncate">
              {contactStatus || "Online"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <button 
            className="text-[#8696a0] hover:text-white transition-colors p-2 -m-2 cursor-pointer"
            onMouseEnter={handleIconEnter}
            onMouseLeave={handleIconLeave}
          >
            <Search size={20} />
          </button>
          <div className="relative" ref={menuRef}>
            <button
              className="text-[#8696a0] hover:text-white transition-colors p-2 -m-2 cursor-pointer"
              onClick={() => setMenuOpen((prev) => !prev)}
              onMouseEnter={handleIconEnter}
              onMouseLeave={handleIconLeave}
            >
              <MoreVertical size={20} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-[#233138] rounded-lg shadow-lg z-50 py-1">
                <button
                  onClick={handleCloseChat}
                  className="flex items-center gap-3 px-4 py-3 text-[#e9edef] hover:bg-[#2a3942] transition-colors w-full text-left text-sm cursor-pointer"
                >
                  <XCircle size={18} />
                  Close chat
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Messages container */}
      <div
        className="flex-1 overflow-y-auto px-4 md:px-[60px] py-0 relative scrollbar-thin scrollbar-thumb-gray-400/40 dark:scrollbar-thumb-[#2a3942] scrollbar-track-transparent"
        style={wallpaperStyle}
      >
        <div className="min-h-full flex flex-col justify-end py-[12px] text-white">
          {chatMessages.map((msg, index) => {
            const isCompany = (msg.sender_type || "customer") === "company";
            const time = formatTime(msg.timestamp);
            return (
              <div
                key={msg.id || `msg-${index}-${msg.timestamp || Date.now()}`}
                className={`flex mb-1 ${
                  isCompany ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`relative px-[9px] py-[6px] rounded-[7.5px] max-w-[65%] shadow-sm ${
                    isCompany
                      ? "bg-[#005c4b] text-white ml-10 md:ml-[60px]"
                      : "bg-[#202c33] text-white mr-10 md:mr-[60px]"
                  }`}
                  style={{
                    borderRadius: isCompany
                      ? "7.5px 7.5px 0 7.5px"
                      : "7.5px 7.5px 7.5px 0",
                  }}
                >
                  {(msg.mediaType && msg.mediaType !== 'none') && (
                    <MessageWithMedia
                      message={msg}
                      mediaCacheRef={mediaCacheRef}
                    />
                  )}
                  {(msg.message || msg.message_text) && (
                    <div
                      className="text-[14.2px] leading-[19px] whitespace-pre-wrap"
                      style={{ overflowWrap: "break-word" }}
                    >
                      {msg.message || msg.message_text}
                    </div>
                  )}
                  <div className="flex items-center justify-end mt-1 gap-1 ml-4">
                    <span className="text-[11px] text-[#8696a0] leading-[14px]">
                      {time}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      </div>

      {/* Message input area */}
      <div className="px-4 py-[10px] bg-[#202c33] space-y-2">
        {/* Media Preview */}
        {selectedMedia && (
          <div className="relative rounded-lg border border-[#8696a026] bg-[#2a3942] p-3">
            <button
              onClick={handleRemoveMedia}
              className="absolute top-2 right-2 p-1.5 rounded-lg bg-[#0b141a]/80 text-[#8696a0] hover:text-white hover:bg-[#0b141a] transition-colors z-10"
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
                <div className="w-20 h-20 flex items-center justify-center rounded-lg bg-[#0b141a]">
                  <Paperclip size={24} className="text-[#8696a0]" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {selectedMedia.name}
                </p>
                <p className="text-xs text-[#8696a0]">
                  {(selectedMedia.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center gap-[10px]">
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleMediaSelect}
            accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.mov,.avi,.webm,.mp3,.wav,.ogg,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip"
            className="hidden"
            disabled={!activeChat || uploading}
          />
          <button 
            className="text-[#8696a0] hover:text-white transition-colors p-2 -m-2 cursor-pointer"
            onMouseEnter={handleIconEnter}
            onMouseLeave={handleIconLeave}
          >
            <Smile size={24} />
          </button>
          <button 
            onClick={() => fileInputRef.current?.click()}
            disabled={!activeChat || uploading}
            className="text-[#8696a0] hover:text-white transition-colors p-2 -m-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onMouseEnter={handleIconEnter}
            onMouseLeave={handleIconLeave}
            title="Attach media"
          >
            <Paperclip size={24} />
          </button>
          <button 
            onClick={() => setShowTemplatePopup(true)}
            disabled={!activeChat}
            className="text-[#8696a0] hover:text-white transition-colors p-2 -m-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            onMouseEnter={handleIconEnter}
            onMouseLeave={handleIconLeave}
            title="Templates"
          >
            <FileText size={24} />
          </button>
          <div className="flex-1 bg-[#2a3942] rounded-[21px] min-h-[42px] flex items-center px-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  if (selectedMedia) {
                    handleMediaUpload();
                  } else if (input.trim()) {
                    handleSend();
                  }
                }
              }}
              placeholder={selectedMedia ? "Add a caption (optional)..." : "Type a message"}
              className="flex-1 bg-transparent text-white text-[15px] placeholder-[#8696a0] border-none outline-none py-[9px] px-[12px] leading-[20px]"
              disabled={uploading}
            />
          </div>
          {(input.trim() || selectedMedia) ? (
            <button
              onClick={handleSend}
              disabled={uploading || (!selectedMedia && !input.trim())}
              className="text-[#8696a0] hover:text-white transition-colors p-2 -m-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onMouseEnter={handleIconEnter}
              onMouseLeave={handleIconLeave}
            >
              {uploading ? (
                <div className="animate-spin inline-block size-5 border-2 border-current border-t-transparent rounded-full" />
              ) : (
                <Send size={24} />
              )}
            </button>
          ) : (
            <button 
              className="text-[#8696a0] hover:text-white transition-colors p-2 -m-2 cursor-pointer"
              onMouseEnter={handleIconEnter}
              onMouseLeave={handleIconLeave}
            >
              <Mic size={24} />
            </button>
          )}
        </div>
      </div>

      <TemplatePopup
        isOpen={showTemplatePopup}
        onClose={() => setShowTemplatePopup(false)}
        onSelectTemplate={handleTemplateSelect}
        activeContactId={activeChat}
      />
    </div>
  );
}
