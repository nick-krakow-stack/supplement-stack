import { useState, type InputHTMLAttributes, type KeyboardEvent } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  hint?: string;
}

export default function PasswordField({ label, hint, id, className = '', onKeyUp, ...props }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const hintId = id ? `${id}-hint` : undefined;
  const capsId = id ? `${id}-caps-lock` : undefined;

  const handleKeyUp = (event: KeyboardEvent<HTMLInputElement>) => {
    setCapsLock(event.getModifierState('CapsLock'));
    onKeyUp?.(event);
  };

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-slate-700">
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          id={id}
          type={visible ? 'text' : 'password'}
          className={`min-h-11 w-full pr-14 ${className}`}
          aria-describedby={[props['aria-describedby'], hint ? hintId : null, capsLock ? capsId : null]
            .filter(Boolean)
            .join(' ') || undefined}
          onKeyUp={handleKeyUp}
          onBlur={(event) => {
            setCapsLock(false);
            props.onBlur?.(event);
          }}
        />
        <button
          type="button"
          onClick={() => setVisible((current) => !current)}
          className="absolute inset-y-0 right-0 flex min-h-11 w-12 items-center justify-center rounded-l-none bg-transparent p-0 text-slate-500 hover:text-blue-700"
          aria-label={visible ? `${label} verbergen` : `${label} anzeigen`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff size={20} aria-hidden="true" /> : <Eye size={20} aria-hidden="true" />}
        </button>
      </div>
      {hint && <p id={hintId} className="mt-1 text-sm text-slate-500">{hint}</p>}
      {capsLock && <p id={capsId} className="mt-1 text-sm font-semibold text-amber-700">Die Feststelltaste ist aktiv.</p>}
    </div>
  );
}
