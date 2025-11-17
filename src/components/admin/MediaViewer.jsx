import { useEffect } from 'react'
import { X, Download } from 'lucide-react'

export default function MediaViewer({ mediaUrl, mediaType, mediaFileName, onClose }) {
  useEffect(() => {
    // Close on ESC key
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleEsc)
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [onClose])

  const handleDownload = () => {
    if (mediaUrl) {
      const a = document.createElement('a')
      a.href = mediaUrl
      a.download = mediaFileName || 'media'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full h-full flex items-center justify-center p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-3 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
          title="Close (ESC)"
        >
          <X size={24} />
        </button>

        {/* Download Button */}
        <button
          onClick={handleDownload}
          className="absolute top-4 right-16 z-10 p-3 rounded-full bg-black/70 text-white hover:bg-black/90 transition-colors"
          title="Download"
        >
          <Download size={24} />
        </button>

        {/* Media Content */}
        <div className="max-w-[90vw] max-h-[90vh] flex items-center justify-center">
          {mediaType === 'image' && mediaUrl && (
            <img
              src={mediaUrl}
              alt={mediaFileName || 'Image'}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
          )}

          {mediaType === 'video' && mediaUrl && (
            <video
              src={mediaUrl}
              controls
              autoPlay
              className="max-w-full max-h-[90vh] rounded-lg"
              onClick={(e) => e.stopPropagation()}
            >
              Your browser does not support the video tag.
            </video>
          )}

          {mediaType === 'audio' && mediaUrl && (
            <div className="bg-slate-800/90 rounded-xl p-8 min-w-[400px]">
              <p className="text-white text-center mb-4 font-semibold">
                {mediaFileName || 'Audio File'}
              </p>
              <audio src={mediaUrl} controls autoPlay className="w-full">
                Your browser does not support the audio tag.
              </audio>
            </div>
          )}

          {(mediaType === 'document' || !mediaType) && mediaUrl && (
            <div className="bg-slate-800/90 rounded-xl p-8 max-w-md">
              <div className="text-center text-white">
                <p className="text-lg font-semibold mb-4">{mediaFileName || 'Document'}</p>
                <p className="text-sm text-slate-400 mb-6">
                  Click the download button to save this file
                </p>
                <a
                  href={mediaUrl}
                  download={mediaFileName || 'file'}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                >
                  <Download size={20} />
                  Download File
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

