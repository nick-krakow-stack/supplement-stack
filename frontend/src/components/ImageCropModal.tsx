import { useRef, useState, useEffect, useCallback } from 'react';
import { Upload, ZoomIn, ZoomOut, Check, X, RotateCcw, Loader } from 'lucide-react';

const CANVAS_SIZE = 272; // viewport circle diameter (px)
const OUTPUT_SIZE = 200; // output image size (px)

interface ImageCropModalProps {
  onCrop?: (dataUrl: string) => void;
  onClose: () => void;
  currentImageUrl?: string;
  /** When provided, the cropped image is uploaded to POST /api/products/:productId/image */
  productId?: number;
  /** Optional upload target for admin/versioned image uploads. Defaults to /api/products/:productId/image. */
  uploadEndpoint?: string;
  /** Optional optimistic-lock version sent as If-Match and form field version. */
  uploadVersion?: number | null;
  /** Called with the stored image_url after a successful upload */
  onSuccess?: (imageUrl: string, response?: { image_url: string; image_r2_key?: string | null; product_version?: number | null }) => void;
  /** Called when the direct upload fails. */
  onError?: (message: string) => void;
}

export default function ImageCropModal({
  onCrop,
  onClose,
  currentImageUrl,
  productId,
  uploadEndpoint,
  uploadVersion,
  onSuccess,
  onError,
}: ImageCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const [isDragOver, setIsDragOver] = useState(false);
  const [, forceUpdate] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const resolvedUploadEndpoint = uploadEndpoint ?? (productId !== undefined ? `/api/products/${productId}/image` : null);

  // ── load image from File ──
  const loadFile = useCallback((file: File) => {
    if (!file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const fitScale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height) * 1.05;
        setScale(fitScale);
        setOffset({ x: 0, y: 0 });
        setImage(img);
      };
      img.src = e.target!.result as string;
    };
    reader.readAsDataURL(file);
  }, []);

  // ── draw frame ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d')!;
    const s = CANVAS_SIZE;

    ctx.clearRect(0, 0, s, s);

    // dimmed overlay for outside circle
    ctx.fillStyle = 'rgba(15, 15, 25, 0.55)';
    ctx.fillRect(0, 0, s, s);

    // image clipped to circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
    ctx.clip();

    const drawW = image.width * scale;
    const drawH = image.height * scale;
    const drawX = (s - drawW) / 2 + offset.x;
    const drawY = (s - drawH) / 2 + offset.y;
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
    ctx.restore();

    // circle border
    ctx.strokeStyle = '#818cf8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(s / 2, s / 2, s / 2 - 6, 0, Math.PI * 2);
    ctx.stroke();
  }, [image, scale, offset]);

  // ── mouse pan ──
  const handleMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragStart.current = { x: e.clientX - offset.x, y: e.clientY - offset.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging.current) return;
    setOffset({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
  };
  const handleMouseUp = () => { dragging.current = false; forceUpdate(n => n + 1); };

  // ── touch pan ──
  const touchStart = useRef({ x: 0, y: 0 });
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragging.current = true;
    touchStart.current = { x: t.clientX - offset.x, y: t.clientY - offset.y };
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging.current) return;
    e.preventDefault();
    const t = e.touches[0];
    setOffset({ x: t.clientX - touchStart.current.x, y: t.clientY - touchStart.current.y });
  };

  // ── wheel zoom ──
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setScale(s => Math.min(8, Math.max(0.3, s - e.deltaY * 0.002 * s)));
  };

  // ── zoom buttons ──
  const zoomIn = () => setScale(s => Math.min(8, +(s * 1.15).toFixed(3)));
  const zoomOut = () => setScale(s => Math.max(0.3, +(s / 1.15).toFixed(3)));
  const resetPos = () => { setOffset({ x: 0, y: 0 }); };

  // ── crop output ──
  const handleCrop = async () => {
    if (!image) return;
    const out = document.createElement('canvas');
    out.width = OUTPUT_SIZE;
    out.height = OUTPUT_SIZE;
    const ctx = out.getContext('2d')!;
    const ratio = OUTPUT_SIZE / CANVAS_SIZE;

    ctx.save();
    ctx.beginPath();
    ctx.arc(OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, OUTPUT_SIZE / 2, 0, Math.PI * 2);
    ctx.clip();

    const drawW = image.width * scale * ratio;
    const drawH = image.height * scale * ratio;
    const drawX = (OUTPUT_SIZE - drawW) / 2 + offset.x * ratio;
    const drawY = (OUTPUT_SIZE - drawH) / 2 + offset.y * ratio;
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
    ctx.restore();

    const dataUrl = out.toDataURL('image/jpeg', 0.88);

    // If an upload target + onSuccess are provided, upload directly to backend.
    if (resolvedUploadEndpoint && onSuccess) {
      setUploading(true);
      setUploadError(null);
      try {
        const blob = await new Promise<Blob>((resolve, reject) => {
          out.toBlob((b) => { if (b) resolve(b); else reject(new Error('Canvas toBlob failed')); }, 'image/jpeg', 0.88);
        });
        const formData = new FormData();
        formData.append('image', blob, 'product.jpg');
        if (uploadVersion !== null && uploadVersion !== undefined) {
          formData.append('version', String(uploadVersion));
        }
        const headers = new Headers();
        if (uploadVersion !== null && uploadVersion !== undefined) {
          headers.set('If-Match', String(uploadVersion));
        }
        const res = await fetch(resolvedUploadEndpoint, {
          method: 'POST',
          credentials: 'include',
          headers,
          body: formData,
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({})) as { error?: string; current_version?: number | null };
          const conflictSuffix = res.status === 409 && errData.current_version !== undefined && errData.current_version !== null
            ? ` Aktuelle Version: ${errData.current_version}.`
            : '';
          throw new Error(`${errData.error ?? `Upload fehlgeschlagen (${res.status})`}${conflictSuffix}`);
        }
        const data = await res.json() as { image_url: string; image_r2_key?: string | null; product_version?: number | null };
        onSuccess(data.image_url, data);
        onClose();
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Upload fehlgeschlagen';
        setUploadError(message);
        onError?.(message);
      } finally {
        setUploading(false);
      }
      return;
    }

    // Fallback: pass dataUrl to parent via onCrop callback
    if (onCrop) {
      onCrop(dataUrl);
    }
  };

  // ── drag-and-drop ──
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file);
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xs mx-4 p-5 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-gray-900 text-sm">Produktfoto zuschneiden</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X size={17} />
          </button>
        </div>

        {!image ? (
          /* ── Drop zone ── */
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleDrop}
            className={`flex flex-col items-center justify-center gap-3 border-2 border-dashed rounded-2xl p-10 cursor-pointer transition-colors select-none ${
              isDragOver
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-200 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50/50'
            }`}
            onClick={() => document.getElementById('img-crop-file-input')?.click()}
          >
            {currentImageUrl ? (
              <img
                src={currentImageUrl}
                alt="Aktuelles Foto"
                className="w-16 h-16 rounded-full object-cover opacity-60 mb-1"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                <Upload size={22} className="text-indigo-400" />
              </div>
            )}
            <div className="text-center">
              <p className="text-sm font-medium text-gray-700">
                {currentImageUrl ? 'Neues Foto wählen' : 'Bild auswählen'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">Hierher ziehen oder klicken</p>
            </div>
            <input
              id="img-crop-file-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) loadFile(f); }}
            />
          </div>
        ) : (
          <>
            {/* ── Canvas crop area ── */}
            <div className="flex justify-center">
              <canvas
                ref={canvasRef}
                width={CANVAS_SIZE}
                height={CANVAS_SIZE}
                style={{
                  borderRadius: '50%',
                  cursor: dragging.current ? 'grabbing' : 'grab',
                  touchAction: 'none',
                  display: 'block',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => { dragging.current = false; }}
              />
            </div>

            {/* ── Zoom controls ── */}
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={zoomOut}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Verkleinern"
              >
                <ZoomOut size={15} />
              </button>
              <span className="text-xs text-gray-500 w-12 text-center tabular-nums">
                {Math.round(scale * 100)}%
              </span>
              <button
                type="button"
                onClick={zoomIn}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                aria-label="Vergrößern"
              >
                <ZoomIn size={15} />
              </button>
              <button
                type="button"
                onClick={resetPos}
                className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors ml-1"
                aria-label="Position zurücksetzen"
                title="Zentrieren"
              >
                <RotateCcw size={14} />
              </button>
              <button
                type="button"
                onClick={() => { setImage(null); setScale(1); setOffset({ x: 0, y: 0 }); }}
                className="ml-1 text-xs text-gray-400 hover:text-gray-600 transition-colors px-2 py-1"
              >
                Anderes Bild
              </button>
            </div>

            <p className="text-xs text-gray-400 text-center -mt-1">
              Ziehen zum Verschieben · Scrollen zum Zoomen
            </p>
          </>
        )}

        {/* ── Upload error ── */}
        {uploadError && (
          <p className="text-xs text-red-600 text-center">{uploadError}</p>
        )}

        {/* ── Actions ── */}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="px-4 py-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium rounded-xl text-sm transition-colors disabled:opacity-50"
          >
            Abbrechen
          </button>
          {image && (
            <button
              type="button"
              onClick={handleCrop}
              disabled={uploading}
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold rounded-xl text-sm flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-60"
            >
              {uploading ? (
                <>
                  <Loader size={14} className="animate-spin" />
                  Hochladen…
                </>
              ) : (
                <>
                  <Check size={14} />
                  {resolvedUploadEndpoint ? 'Zuschneiden & Hochladen' : 'Zuschneiden'}
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
