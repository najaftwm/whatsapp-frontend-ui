import { useEffect, useState } from 'react'
import { Paperclip } from 'lucide-react'
import { API_BASE_URL, AUTH_HEADERS } from '../../config/api'
import MediaViewer from './MediaViewer'

const API_BASE = API_BASE_URL
const AUTH_HEADER = AUTH_HEADERS

export default function MessageWithMedia({ message, mediaCacheRef }) {
  const [mediaUrl, setMediaUrl] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showViewer, setShowViewer] = useState(false)

  useEffect(() => {
    const fetchMedia = async () => {
      if (!message.mediaFilePath || !message.id || message.id.toString().startsWith('temp-')) {
        setLoading(false)
        return
      }

      // Check cache first
      const cacheKey = message.id.toString()
      if (mediaCacheRef.current.has(cacheKey)) {
        setMediaUrl(mediaCacheRef.current.get(cacheKey))
        setLoading(false)
        return
      }

      // Fetch media as blob with credentials
      try {
        const res = await fetch(`${API_BASE}/getMedia.php?message_id=${message.id}`, {
          credentials: 'include',
          headers: {
            Authorization: AUTH_HEADER.Authorization,
          },
        })

        if (!res.ok) {
          setLoading(false)
          return
        }

        const blob = await res.blob()
        const objectUrl = URL.createObjectURL(blob)
        
        // Cache the object URL
        mediaCacheRef.current.set(cacheKey, objectUrl)
        
        setMediaUrl(objectUrl)
      } catch (error) {
        // Error handled silently
      } finally {
        setLoading(false)
      }
    }

    fetchMedia()
  }, [message.id, message.mediaFilePath, mediaCacheRef])

  const displayUrl = message.mediaPreview || mediaUrl

  if (message.mediaType === 'image') {
    return (
      <>
        <div className="mb-2 rounded-xl overflow-hidden max-w-full relative">
          {loading && !displayUrl ? (
            <div className="w-full h-48 flex items-center justify-center bg-slate-700/50 rounded-lg">
              <div className="animate-spin inline-block size-6 border-2 border-current border-t-transparent text-emerald-500 rounded-full" />
            </div>
          ) : displayUrl ? (
            <img
              src={displayUrl}
              alt={message.mediaFileName || 'Image'}
              className="max-w-full max-h-64 object-contain rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => {
                if (displayUrl && !message.isPending) {
                  setShowViewer(true)
                }
              }}
              onError={(e) => {
                e.target.style.display = 'none'
              }}
            />
          ) : null}
          {message.isPending && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center rounded-lg pointer-events-none">
              <div className="animate-spin inline-block size-5 border-2 border-current border-t-transparent text-emerald-500 rounded-full" />
            </div>
          )}
        </div>
        {showViewer && displayUrl && (
          <MediaViewer
            mediaUrl={displayUrl}
            mediaType={message.mediaType}
            mediaFileName={message.mediaFileName}
            onClose={() => setShowViewer(false)}
          />
        )}
      </>
    )
  }

  if (message.mediaType === 'video') {
    return (
      <>
        <div className="mb-2 rounded-xl overflow-hidden max-w-full relative">
          {loading && !displayUrl ? (
            <div className="w-full h-48 flex items-center justify-center bg-slate-700/50 rounded-lg">
              <div className="animate-spin inline-block size-6 border-2 border-current border-t-transparent text-emerald-500 rounded-full" />
            </div>
          ) : displayUrl ? (
            <div className="relative">
              <video
                src={displayUrl}
                controls
                className="max-w-full max-h-64 rounded-lg"
                onError={(e) => {
                  e.target.style.display = 'none'
                }}
              >
                Your browser does not support the video tag.
              </video>
              {!message.isPending && (
                <button
                  onClick={() => setShowViewer(true)}
                  className="absolute top-2 right-2 px-3 py-1.5 bg-black/70 text-white text-xs rounded-lg hover:bg-black/90 transition-colors"
                  title="Open in fullscreen"
                >
                  Fullscreen
                </button>
              )}
            </div>
          ) : null}
          {message.isPending && (
            <div className="absolute inset-0 bg-slate-900/50 flex items-center justify-center rounded-lg pointer-events-none">
              <div className="animate-spin inline-block size-5 border-2 border-current border-t-transparent text-emerald-500 rounded-full" />
            </div>
          )}
        </div>
        {showViewer && displayUrl && (
          <MediaViewer
            mediaUrl={displayUrl}
            mediaType={message.mediaType}
            mediaFileName={message.mediaFileName}
            onClose={() => setShowViewer(false)}
          />
        )}
      </>
    )
  }

  if (message.mediaType === 'audio') {
    return (
      <>
        <div className="mb-2 rounded-xl overflow-hidden max-w-full relative">
          {loading ? (
            <div className="bg-slate-800/50 p-3 rounded-lg flex items-center justify-center">
              <div className="animate-spin inline-block size-5 border-2 border-current border-t-transparent text-emerald-500 rounded-full" />
            </div>
          ) : mediaUrl ? (
            <div className="bg-slate-800/50 p-3 rounded-lg relative">
              <audio src={mediaUrl} controls className="w-full">
                Your browser does not support the audio tag.
              </audio>
              {!message.isPending && (
                <button
                  onClick={() => setShowViewer(true)}
                  className="mt-2 w-full px-3 py-1.5 bg-slate-700 text-white text-xs rounded-lg hover:bg-slate-600 transition-colors"
                  title="Open in fullscreen"
                >
                  Open Player
                </button>
              )}
            </div>
          ) : null}
        </div>
        {showViewer && mediaUrl && (
          <MediaViewer
            mediaUrl={mediaUrl}
            mediaType={message.mediaType}
            mediaFileName={message.mediaFileName}
            onClose={() => setShowViewer(false)}
          />
        )}
      </>
    )
  }

  // Document or other
  return (
    <div className="mb-2 rounded-xl overflow-hidden max-w-full relative">
      {loading ? (
        <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
          <div className="animate-spin inline-block size-4 border-2 border-current border-t-transparent text-emerald-500 rounded-full" />
          <span className="text-sm text-slate-400">Loading...</span>
        </div>
      ) : mediaUrl ? (
        <a
          href={mediaUrl}
          target="_blank"
          rel="noopener noreferrer"
          download={message.mediaFileName || 'file'}
          className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg hover:bg-slate-700/50 transition-colors"
        >
          <Paperclip size={18} className="text-slate-300" />
          <span className="text-sm truncate">
            {message.mediaFileName || 'Document'}
          </span>
        </a>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-slate-800/50 rounded-lg">
          <Paperclip size={18} className="text-slate-300" />
          <span className="text-sm text-slate-400 truncate">
            {message.mediaFileName || 'Document'}
          </span>
        </div>
      )}
    </div>
  )
}

