import { Download, FileText, X } from 'lucide-react';
import { useState } from 'react';

interface FilePreviewProps {
  url: string;
  fileName: string;
  fileType: string | null;
  title: string;
  onClose: () => void;
}

export function FilePreview({
  url,
  fileName,
  fileType,
  title,
  onClose,
}: FilePreviewProps) {
  const [downloading, setDownloading] = useState(false);

  const isImage =
    Boolean(fileType && fileType.startsWith('image/')) ||
    /\.(jpe?g|png|webp)$/i.test(fileName);

  async function handleDownload() {
    setDownloading(true);
    try {
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Download failed');
      const blob = await resp.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = fileName || 'test-paper';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(objectUrl);
    } catch {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName || 'test-paper';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Preview ${title}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/60 backdrop-blur-xs p-0 sm:p-4"
    >
      <div className="w-full max-w-3xl h-[88vh] sm:h-[85vh] rounded-t-3xl sm:rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#0F2A4A]/8 text-[#0F2A4A] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-bold text-[#0F2A4A] truncate">
                {title}
              </h2>
              <p className="text-xs text-slate-500 truncate">{fileName}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={downloading}
              onClick={() => void handleDownload()}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#0F2A4A] hover:bg-[#163861] disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloading ? 'Downloading...' : 'Download'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close preview"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 bg-[#F7F8FA] overflow-auto flex items-center justify-center p-3 sm:p-4">
          {isImage ? (
            <img
              src={url}
              alt={title}
              referrerPolicy="no-referrer"
              className="max-w-full max-h-full rounded-xl object-contain shadow-sm bg-white"
            />
          ) : (
            <iframe
              src={url}
              title={title}
              className="w-full h-full rounded-xl border border-slate-200 bg-white"
            />
          )}
        </div>

        <div className="px-4 py-2.5 border-t border-slate-200 bg-white text-[11px] text-slate-500 flex items-center justify-between gap-2 shrink-0">
          <span>Secure link valid for 5 minutes</span>
          <button
            type="button"
            onClick={() => void handleDownload()}
            className="font-semibold text-[#0F2A4A] hover:underline cursor-pointer"
          >
            Save copy to device
          </button>
        </div>
      </div>
    </div>
  );
}
