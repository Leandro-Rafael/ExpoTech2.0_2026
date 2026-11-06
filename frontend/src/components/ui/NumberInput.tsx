import { useEffect, useRef, useState, type ClipboardEvent, type ComponentPropsWithRef, type FormEvent, type KeyboardEvent } from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/cn';
import { classesControle } from './Input';
import { useAcessibilidadeCampo } from './Field';

export interface PropsCampoNumero extends Omit<ComponentPropsWithRef<'input'>, 'value' | 'defaultValue' | 'onChange' | 'type' | 'size' | 'min' | 'max' | 'step'> {
  value: number | null | undefined;
  onChange: (value: number | null) => void;
  /** Casas decimais permitidas (0 = inteiro). Padrão 2. */
  casasDecimais?: number;
  min?: number;
  max?: number;
  /** Incremento dos botões +/− e das setas do teclado. */
  step?: number;
  permitirNegativo?: boolean;
  /** Texto fixo à direita: "kg", "L", "%"... */
  unidade?: string;
  /** Mostra botões − / +. */
  comBotoes?: boolean;
  invalido?: boolean;
  tamanhoCampo?: 'sm' | 'md' | 'lg';
}

const tamanhos = { sm: 'h-9 text-[13px]', md: 'h-11 text-sm', lg: 'h-12 text-[15px]' };

function paraTexto(v: number | null | undefined, casas: number): string {
  if (v == null || Number.isNaN(v)) return '';
  const fixo = casas > 0 ? String(Number(v.toFixed(casas))) : String(Math.trunc(v));
  return fixo.replace('.', ',');
}

/** Mantém apenas dígitos, um separador decimal (vírgula) e sinal opcional. */
function limpar(bruto: string, casas: number, permitirNegativo: boolean): string {
  let s = bruto.replace(/\./g, ',');
  const negativo = permitirNegativo && s.trim().startsWith('-');
  s = s.replace(/[^\d,]/g, '');
  if (casas === 0) s = s.replace(/,/g, '');
  const i = s.indexOf(',');
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '').slice(0, casas);
  return (negativo ? '-' : '') + s;
}

function converter(texto: string): number | null {
  if (!texto || texto === '-' || texto === ',' || texto === '-,') return null;
  const n = Number(texto.replace(',', '.'));
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
export function CampoNumero({
  value, onChange, casasDecimais = 2, min, max, step = 1, permitirNegativo = false, unidade, comBotoes = false,
  invalido, tamanhoCampo = 'md', className, onBlur, onFocus, disabled, ref, ...props
}: PropsCampoNumero) {
  const resto = useAcessibilidadeCampo(props);
  const [texto, setTexto] = useState(() => paraTexto(value, casasDecimais));
  const focado = useRef(false);
  const negativoPermitido = permitirNegativo || (min != null && min < 0);

  // Sincroniza valor externo (reset do form etc.) quando não está em edição.
  useEffect(() => {
    if (!focado.current) setTexto(paraTexto(value, casasDecimais));
  }, [value, casasDecimais]);

  const confirmar = (proximo: string) => {
    setTexto(proximo);
    onChange(converter(proximo));
  };

  const limitar = (n: number) => {
    let v = n;
    if (min != null) v = Math.max(min, v);
    if (max != null) v = Math.min(max, v);
    return Number(v.toFixed(casasDecimais));
  };

  const incrementar = (direcao: 1 | -1) => {
    const atual = converter(texto) ?? (min != null && min > 0 ? min - step * direcao : 0);
    const proximo = limitar(atual + direcao * step);
    setTexto(paraTexto(proximo, casasDecimais));
    onChange(proximo);
  };

  const aoTeclar = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'ArrowUp') { e.preventDefault(); incrementar(1); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); incrementar(-1); return; }
    if (e.key.length !== 1) return; // teclas de controle (Tab, Backspace, setas...)
    const ehDigito = /\d/.test(e.key);
    const ehSeparador = (e.key === ',' || e.key === '.') && casasDecimais > 0 && !texto.includes(',');
    const ehMenos = e.key === '-' && negativoPermitido && (e.currentTarget.selectionStart ?? 0) === 0 && !texto.includes('-');
    if (!ehDigito && !ehSeparador && !ehMenos) e.preventDefault();
  };

  // Cobre teclados virtuais/IME que não disparam keydown com `key` útil.
  const antesDeDigitar = (e: FormEvent<HTMLInputElement>) => {
    const dados = (e.nativeEvent as InputEvent).data;
    if (dados && !/^[\d.,-]+$/.test(dados)) e.preventDefault();
  };

  const aoColar = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const colado = e.clipboardData.getData('text');
    const elemento = e.currentTarget;
    const inicio = elemento.selectionStart ?? texto.length;
    const fim = elemento.selectionEnd ?? texto.length;
    confirmar(limpar(texto.slice(0, inicio) + colado + texto.slice(fim), casasDecimais, negativoPermitido));
  };

  return (
    <div className={cn('relative flex items-center', disabled && 'opacity-55')}>
      {comBotoes && (
        <button type="button" tabIndex={-1} disabled={disabled || (min != null && (converter(texto) ?? min) <= min)} onClick={() => incrementar(-1)}
          aria-label="Diminuir" className="absolute left-1.5 z-10 inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-fg disabled:opacity-40">
          <Minus className="size-4" aria-hidden />
        </button>
      )}
      <input
        ref={ref}
        type="text"
        inputMode={casasDecimais > 0 ? 'decimal' : 'numeric'}
        autoComplete="off"
        pattern={casasDecimais > 0 ? '-?[0-9]*[,.]?[0-9]*' : '-?[0-9]*'}
        aria-invalid={invalido || (resto['aria-invalid'] as boolean | undefined) || undefined}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={converter(texto) ?? undefined}
        role="spinbutton"
        disabled={disabled}
        value={texto}
        onKeyDown={aoTeclar}
        onBeforeInput={antesDeDigitar}
        onPaste={aoColar}
        onDrop={(e) => e.preventDefault()}
        onChange={(e) => confirmar(limpar(e.target.value, casasDecimais, negativoPermitido))}
        onFocus={(e) => { focado.current = true; onFocus?.(e); }}
        onBlur={(e) => {
          focado.current = false;
          const n = converter(texto);
          if (n != null) { const c = limitar(n); setTexto(paraTexto(c, casasDecimais)); if (c !== n) onChange(c); }
          else if (texto) setTexto('');
          onBlur?.(e);
        }}
        className={cn(
          classesControle, tamanhos[tamanhoCampo], 'tabular',
          comBotoes ? 'px-11 text-center' : 'pl-3.5', !comBotoes && (unidade ? 'pr-12' : 'pr-3.5'),
          className,
        )}
        {...resto}
      />
      {unidade && !comBotoes && <span className="pointer-events-none absolute right-3.5 text-sm text-muted">{unidade}</span>}
      {comBotoes && (
        <button type="button" tabIndex={-1} disabled={disabled || (max != null && (converter(texto) ?? 0) >= max)} onClick={() => incrementar(1)}
          aria-label="Aumentar" className="absolute right-1.5 z-10 inline-flex size-8 items-center justify-center rounded-lg text-muted hover:bg-white/5 hover:text-fg disabled:opacity-40">
          <Plus className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
