import { useEffect, useState } from 'react';

interface EditStackModalProps {
  initialName: string;
  initialDescription?: string;
  onSave: (name: string, description: string) => void | Promise<void>;
  onClose: () => void;
}

export default function EditStackModal({
  initialName,
  initialDescription = '',
  onSave,
  onClose,
}: EditStackModalProps) {
  const [name, setName] = useState(initialName);
  const [desc, setDesc] = useState(initialDescription);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const handleSave = async () => {
    const finalName = name.trim() || initialName;
    setSaving(true);
    setError('');
    try {
      await onSave(finalName, desc.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
      return;
    }
    setSaving(false);
  };

  return (
    <div className="ss-modal-overlay" onClick={onClose}>
      <div className="ss-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ss-modal-header">
          <div className="ss-modal-title">Stack bearbeiten</div>
          <button className="ss-modal-close" onClick={onClose} aria-label="Schließen">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="ss-modal-field">
          <div className="ss-modal-label">Stack-Name</div>
          <input
            className="ss-modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Morning Stack"
            autoFocus
          />
        </div>
        <div className="ss-modal-field">
          <div className="ss-modal-label">
            Beschreibung{' '}
            <span
              style={{
                color: '#c4c9d8',
                fontWeight: 500,
                textTransform: 'none',
                letterSpacing: 0,
              }}
            >
              (optional)
            </span>
          </div>
          <textarea
            className="ss-modal-textarea"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            placeholder="Kurze Beschreibung deines Stacks, z. B. Ziele oder Zeitraum…"
          />
        </div>
        {error && (
          <div
            style={{
              marginBottom: 14,
              padding: '10px 14px',
              borderRadius: 10,
              background: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {error}
          </div>
        )}
        <div className="ss-modal-actions">
          <button className="ss-modal-btn-cancel" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button className="ss-modal-btn-save" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </div>
  );
}
