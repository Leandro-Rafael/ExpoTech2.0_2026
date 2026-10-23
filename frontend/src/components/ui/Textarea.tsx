import { useState, type ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/cn';
import { controlClasses } from './Input';

export interface TextareaProps extends ComponentPropsWithRef<'textarea'> {
  invalid?: boolean;
  /** Mostra contador "12/500" quando maxLength é definido. */
  showCount?: boolean;
}

/** Área de texto. Compatível com register(). */
export function Textarea({ invalid, showCount = true, className, maxLength, onChange, ...rest }: TextareaProps) {
  const [count, setCount] = useState(() => String(rest.value ?? rest.defaultValue ?? '').length);
  return (
    <div className="relative">
      <textarea
        aria-invalid={invalid || rest['aria-invalid'] || undefined}
        maxLength={maxLength}
        onChange={(e) => { setCount(e.target.value.length); onChange?.(e); }}
        className={cn(controlClasses, 'min-h-24 resize-y px-3.5 py-3 text-sm leading-relaxed', showCount && maxLength && 'pb-7', className)}
        {...rest}
      />
      {showCount && maxLength && (
        <span className="pointer-events-none absolute right-3 bottom-2 text-[11px] text-subtle tabular" aria-hidden>
          {rest.value != null ? String(rest.value).length : count}/{maxLength}
        </span>
      )}
    </div>
  );
}
