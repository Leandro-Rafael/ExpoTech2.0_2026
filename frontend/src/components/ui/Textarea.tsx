import { useState, type ComponentPropsWithRef } from 'react';
import { cn } from '@/lib/cn';
import { classesControle } from './Input';
import { useAcessibilidadeCampo } from './Field';

export interface PropsAreaTexto extends ComponentPropsWithRef<'textarea'> {
  invalido?: boolean;
  /** Mostra contador "12/500" quando maxLength é definido. */
  mostrarContador?: boolean;
}

/** Área de texto. Compatível com register(). */
export function AreaTexto({ invalido, mostrarContador = true, className, maxLength, onChange, ...props }: PropsAreaTexto) {
  const resto = useAcessibilidadeCampo(props);
  const [contagem, setContagem] = useState(() => String(resto.value ?? resto.defaultValue ?? '').length);
  return (
    <div className="relative">
      <textarea
        aria-invalid={invalido || resto['aria-invalid'] || undefined}
        maxLength={maxLength}
        onChange={(e) => { setContagem(e.target.value.length); onChange?.(e); }}
        className={cn(classesControle, 'min-h-24 resize-y px-3.5 py-3 text-sm leading-relaxed', mostrarContador && maxLength && 'pb-7', className)}
        {...resto}
      />
      {mostrarContador && maxLength && (
        <span className="pointer-events-none absolute right-3 bottom-2 text-[11px] text-subtle tabular" aria-hidden>
          {resto.value != null ? String(resto.value).length : contagem}/{maxLength}
        </span>
      )}
    </div>
  );
}
