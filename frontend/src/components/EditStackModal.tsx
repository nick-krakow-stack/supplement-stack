import { useState } from 'react';
import ModalWrapper from './modals/ModalWrapper';

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
    <ModalWrapper onClose={onClose} title="Stack bearbeiten" size="md">
      <div className="ss-modal ss-modal-embedded">
        <div className="ss-modal-field">
          <label className="ss-modal-label" htmlFor="stack-name">Stack-Name</label>
          <input
            id="stack-name"
            className="ss-modal-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="z. B. Vitamine am Morgen"
            autoFocus
          />
        </div>
        <div className="ss-modal-field">
          <label className="ss-modal-label" htmlFor="stack-description">
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
          </label>
          <textarea
            id="stack-description"
            className="ss-modal-textarea"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            maxLength={1000}
            placeholder="Kurze Beschreibung deines Stacks, z. B. Ziele oder Zeitraum…"
          />
          <div className="mt-1 text-right text-xs font-semibold text-slate-500" aria-live="polite">
            {desc.length} von 1000 Zeichen
          </div>
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
          <button type="button" className="ss-modal-btn-cancel" onClick={onClose} disabled={saving}>
            Abbrechen
          </button>
          <button type="button" className="ss-modal-btn-save" onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </button>
        </div>
      </div>
    </ModalWrapper>
  );
}
