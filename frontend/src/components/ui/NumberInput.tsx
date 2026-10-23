import { useEffect, useRef, useState, type ClipboardEvent, type ComponentPropsWithRef, type FormEvent, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { controlClasses } from './Input';

export interface NumberInputProps extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'size' | 'min' | 'max' | 'step'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Casas decimais permitidas (0 = inteiro). Padrão 2. */
  decimals?: number;
  min?: number;
  max?: number;
  /** Incremento dos botões +/− e das setas do teclado. */
  step?: number;
  allowNegative?: boolean;
  /** Texto fixo à direita: "kg", "L", "%"... */
  unit?: string;
  /** Mostra botões − / +. */
  stepper?: boolean;
  invalid?: boolean;
  inputSize?: 'sm' | 'md' | 'lg';
}

const sizes = { sm: 'h-9 text-[13px]', md: 'h-11 text-sm', lg: 'h-12 text-[15px]' };

function toText(v: number | null | undefined, decimals: number): string {
  if (v == null || Number.isNaN(v)) return '';
  const fixed = decimals > 0 ? String(Number(v.toFixed(decimals))) : String(Math.trunc(v));
  return fixed.replace('.', ',');
}

/** Mantém apenas dígitos, um separador decimal (vírgula) e sinal opcional. */
function sanitize(raw: string, decimals: number, allowNegative: boolean): string {
  let s = raw.replace(/\./g, ',');
  const negative = allowNegative && s.trim().startsWith('-');
  s = s.replace(/[^\d,]/g, '');
  if (decimals === 0) s = s.replace(/,/g, '');
  const i = s.indexOf(',');
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '').slice(0, decimals);
  return (negative ? '-' : '') + s;
}

function parse(text: string): number | null {
  if (!text || text === '-' || text === ',' || text === '-,') return null;
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/**
 * Campo numérico que BLOQUEIA entrada não numérica (teclado, colar, arrastar, IME).
 * Aceita vírgula ou ponto como decimal; exibe em pt-BR. Controlado: use com <Controller>.
 *
 *   <Controller control={control} name="quantityKg" render={({ field, fieldState }) => (
 *     <NumberInput {...field} unit="kg" decimals={2} min={0.01} max={50} invalid={!!fieldState.error} />
 *   )} />
 */
export function NumberInput({
  value, onChange, decimals = 2, min, max, step = 1, allowNegative = false, unit, stepper = false,
  invalid, inputSize = 'md', className, onBlur, onFocus, disabled, ref, ...rest
}: NumberInputProps) {
  const [text, setText] = useState(() => toText(value, decimals));
  const focused = useRef(false);
  const negAllowed = allowNegative || (min != null && min < 0);

  // Sincroniza valor externo (reset do form etc.) quando não está em edição.
  useEffect(() => {
    if (!focused.current) setText(toText(value, decimals));
  }, [value, decimals]);

  const commit = (next: string) => {
    setText(next);
    onChange(parse(next));
  };

  const clamp = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return Number(v.toFixed(decimals));
  };

  const bump = (dir: 1 | -1) => {
    const current = parse(text) ?? (min != null && min > 0 ? min - step * dir : 0);
    const next = clamp(current + dir * step);
    setText(toText(next, decimals));
    onChange(next);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); bump(1); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); bump(-1); return; }
    if (e.key.length !== 1) return; // teclas de controle (Tab, Backspace, setas...)
    const isDigit = /\d/.test(e.key);
    const isSep = (e.key === ',' || e.key === '.') && decimals > 0 && !text.includes(',');
    const isMinus = e.key === '-' && negAllowed && (e.currentTarget.selectionStart ?? 0) === 0 && !text.includes('-');
    if (!isDigit && !isSep && !isMinus) e.preventDefault();
  };

  // Cobre teclados virtuais/IME que não disparam keydown com `key` útil.
  const handleBeforeInput = (e: FormEvent<HTMLInputElement>) => {
    const data = (e.nativeEvent as InputEvent).data;
    if (data && !/^[\d.,-]+$/.test(data)) e.preventDefault();
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const el = e.currentTarget;
    const start = el.selectionStart ?? text.length;
    const end = el.selectionEnd ?? text.length;
    commit(sanitize(text.slice(0, start) + pasted + text.slice(end), decimals, negAllowed));
  };

  return (
    <div className={cn('relative flex items-center', disabled && 'opacity-55')}>
      {stepper && (
        <button type="button" tabIndex={-1} disabled={disabled || (min != null && (parse(text) ?? min) <= min)} onClick={() => bump(-1)}
          aria-label="Diminuir" className="absolute left-1.5 z-10 inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-fg disabled:opacity-40">
          <Minus className="size-4" aria-hidden />
        </button>
      )}
      <input
        ref={ref}
        type="text"
        inputMode={decimals > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        pattern={decimals > 0 ? '-?[0-9]*[,.]?[0-9]*' : '-?[0-9]*'}
        aria-invalid={invalid || undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={parse(text) ?? undefined}
        role="spinbutton"
        disabled={disabled}
        value={text}
        onKeyDown={handleKeyDown}
        onBeforeInput={handleBeforeInput}
        onPaste={handlePaste}
        onDrop={(e) => e.preventDefault()}
        onChange={(e) => commit(sanitize(e.target.value, decimals, negAllowed))}
        onFocus={(e) => { focused.current = true; onFocus?.(e); }}
        onBlur={(e) => {
          focused.current = false;
          const n = parse(text);
          if (n != null) { const c = clamp(n); setText(toText(c, decimals)); if (c !== n) onChange(c); }
          else if (text) setText('');
          onBlur?.(e);
        }}
        className={cn(
          controlClasses, sizes[inputSize], 'tabular',
          stepper ? 'px-11 text-center' : 'pl-3.5', !stepper && (unit ? 'pr-12' : 'pr-3.5'),
          className,
        )}
        {...rest}
      />
      {unit && !stepper && <span className="pointer-events-none absolute right-3.5 text-sm text-muted">{unit}</span>}
      {stepper && (
        <button type="button" tabIndex={-1} disabled={disabled || (max != null && (parse(text) ?? 0) >= max)} onClick={() => bump(1)}
          aria-label="Aumentar" className="absolute right-1.5 z-10 inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-fg disabled:opacity-40">
          <Plus className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
