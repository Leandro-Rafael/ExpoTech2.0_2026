/**
 * Controles de formulário do admin (controlados — use com <Controller>):
 *   CategoryCodesPicker  seleção múltipla de materiais (chips com a cor da categoria)
 *   IconPicker           grade de ícones lucide usados por CategoryIcon/Reward
 *   ColorPicker          seletor de cor + hex + amostras
 *   ListEditor           lista de textos (orientações) com adicionar/remover/reordenar
 */
import { useState } from 'react';
import { Controller, type Control, type FieldValues, type Path } from 'react-hook-form';
import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from 'lucide-react';
import type { CategoryCode } from '@/api/types';
import { ICONES } from '@/components/icons';
import { BotaoIcone, CampoNumero, type PropsCampoNumero } from '@/components/ui';
import { cn } from '@/lib/cn';
import { hexComAlfa } from '@/lib/category';
import { CODIGOS_CATEGORIA, categoriaPadrao } from '@/lib/labels';

interface A11y { id?: string; 'aria-invalid'?: boolean | 'true' | 'false'; 'aria-describedby'?: string }

export function SeletorCategorias({ value, onChange, cores, ...a11y }: {
  value: CategoryCode[]; onChange: (v: CategoryCode[]) => void; cores?: Partial<Record<CategoryCode, string>>;
} & A11y) {
  const alternar = (c: CategoryCode) => onChange(value.includes(c) ? value.filter((x) => x !== c) : [...value, c]);
  return (
    <div role="group" id={a11y.id} aria-describedby={a11y['aria-describedby']} className="flex flex-wrap gap-1.5">
      {CODIGOS_CATEGORIA.map((c) => {
        const marcado = value.includes(c);
        const cor = cores?.[c] ?? categoriaPadrao[c].color;
        return (
          <button key={c} type="button" aria-pressed={marcado} onClick={() => alternar(c)}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] transition-colors',
              marcado ? 'text-fg' : 'border-line text-muted hover:border-line-strong hover:text-fg-soft')}
            style={marcado ? { borderColor: hexComAlfa(cor, 0.55), backgroundColor: hexComAlfa(cor, 0.12) } : undefined}>
            <span className="size-2 rounded-full" style={{ backgroundColor: cor }} aria-hidden />
            {categoriaPadrao[c].name}
            {marcado && <Check className="size-3.5" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/** Nomes únicos de ícones (sem aliases duplicados). */
const NOMES_ICONES = (() => {
  const vistos = new Set<unknown>();
  return Object.entries(ICONES).filter(([, C]) => (vistos.has(C) ? false : (vistos.add(C), true))).map(([n]) => n);
})();

export function SeletorIcone({ value, onChange, cor, ...a11y }: { value: string; onChange: (v: string) => void; cor?: string } & A11y) {
  return (
    <div role="radiogroup" id={a11y.id} aria-describedby={a11y['aria-describedby']} aria-label="Ícone"
      className="grid max-h-44 grid-cols-8 gap-1 overflow-y-auto rounded-xl border border-line bg-bg-deep/50 p-1.5 sm:grid-cols-10" data-lenis-prevent>
      {NOMES_ICONES.map((n) => {
        const Icon = ICONES[n];
        const marcado = value === n;
        return (
          <button key={n} type="button" role="radio" aria-checked={marcado} aria-label={n} title={n} onClick={() => onChange(n)}
            className={cn('flex aspect-square items-center justify-center rounded-lg transition-colors',
              marcado ? 'bg-surface-3 shadow-[inset_0_0_0_1px_rgb(236_239_234/0.3)]' : 'text-muted hover:bg-white/[0.05] hover:text-fg')}
            style={marcado && cor ? { color: cor } : undefined}>
            <Icon className="size-[18px]" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}

const AMOSTRAS_CORES = ['#EF4444', '#F97316', '#EAB308', '#22C55E', '#10B981', '#06B6D4', '#3B82F6', '#8B5CF6', '#EC4899', '#A16207', '#6B7280'];

export function SeletorCor({ value, onChange, ...a11y }: { value: string; onChange: (v: string) => void } & A11y) {
  const [texto, setTexto] = useState(value);
  const valida = /^#[0-9a-f]{6}$/i.test(value);
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <label className="relative size-11 shrink-0 cursor-pointer overflow-hidden rounded-[10px] border border-line-strong" style={{ backgroundColor: valida ? value : '#111' }}>
          <span className="sr-only">Escolher cor</span>
          <input type="color" value={valida ? value : '#000000'} onChange={(e) => { const v = e.target.value.toUpperCase(); setTexto(v); onChange(v); }}
            className="absolute inset-0 size-full cursor-pointer opacity-0" />
        </label>
        <input
          {...a11y}
          value={texto}
          maxLength={7}
          spellCheck={false}
          onChange={(e) => {
            let v = e.target.value.trim().replace(/[^#0-9a-fA-F]/g, '');
            if (v && !v.startsWith('#')) v = `#${v}`;
            setTexto(v.toUpperCase());
            onChange(v.toUpperCase());
          }}
          className="h-11 w-32 rounded-[10px] border border-line-strong bg-bg-deep/70 px-3 font-mono text-sm text-fg uppercase focus:border-[rgb(236_239_234/0.36)] focus:shadow-[0_0_0_3px_rgb(197_242_107/0.14)] focus:outline-none aria-invalid:border-danger/70"
        />
      </div>
      <div className="flex flex-wrap gap-1.5" aria-label="Cores sugeridas">
        {AMOSTRAS_CORES.map((c) => (
          <button key={c} type="button" onClick={() => { setTexto(c); onChange(c); }} aria-label={`Cor ${c}`} aria-pressed={value.toUpperCase() === c}
            className={cn('size-6 rounded-md border border-black/30 transition-transform hover:scale-110', value.toUpperCase() === c && 'ring-2 ring-fg ring-offset-2 ring-offset-surface-2')}
            style={{ backgroundColor: c }} />
        ))}
      </div>
    </div>
  );
}

export function EditorLista({ value, onChange, max = 12, maxLength = 300, placeholder, ...a11y }: {
  value: string[]; onChange: (v: string[]) => void; max?: number; maxLength?: number; placeholder?: string;
} & A11y) {
  const [rascunho, setRascunho] = useState('');
  const adicionar = () => {
    const t = rascunho.trim();
    if (!t || value.length >= max) return;
    onChange([...value, t.slice(0, maxLength)]);
    setRascunho('');
  };
  const mover = (i: number, d: -1 | 1) => {
    const n = [...value];
    const j = i + d;
    if (j < 0 || j >= n.length) return;
    [n[i], n[j]] = [n[j], n[i]];
    onChange(n);
  };
  return (
    <div className="space-y-2">
      {value.length > 0 && (
        <ol className="divide-y divide-line rounded-xl border border-line">
          {value.map((g, i) => (
            <li key={`${i}-${g}`} className="flex items-start gap-2 py-1.5 pr-1.5 pl-3">
              <span className="mt-1.5 font-mono text-[11px] text-subtle tabular">{String(i + 1).padStart(2, '0')}</span>
              <input value={g} maxLength={maxLength} aria-label={`Orientação ${i + 1}`}
                onChange={(e) => onChange(value.map((x, k) => (k === i ? e.target.value : x)))}
                className="min-w-0 flex-1 rounded-md bg-transparent px-1.5 py-1 text-[13.5px] text-fg-soft focus:bg-bg-deep focus:outline-none" />
              <BotaoIcone icon={ArrowUp} size="sm" label="Mover para cima" onClick={() => mover(i, -1)} disabled={i === 0} />
              <BotaoIcone icon={ArrowDown} size="sm" label="Mover para baixo" onClick={() => mover(i, 1)} disabled={i === value.length - 1} />
              <BotaoIcone icon={Trash2} size="sm" variant="danger" label="Remover orientação" onClick={() => onChange(value.filter((_, k) => k !== i))} />
            </li>
          ))}
        </ol>
      )}
      <div className="flex gap-2">
        <input
          id={a11y.id} aria-invalid={a11y['aria-invalid']} aria-describedby={a11y['aria-describedby']}
          value={rascunho} maxLength={maxLength} placeholder={placeholder ?? 'Nova orientação'}
          disabled={value.length >= max}
          onChange={(e) => setRascunho(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionar(); } }}
          className="h-10 min-w-0 flex-1 rounded-[10px] border border-line-strong bg-bg-deep/70 px-3 text-[13.5px] text-fg placeholder:text-subtle focus:border-[rgb(236_239_234/0.36)] focus:shadow-[0_0_0_3px_rgb(197_242_107/0.14)] focus:outline-none disabled:opacity-50"
        />
        <button type="button" onClick={adicionar} disabled={!rascunho.trim() || value.length >= max}
          className="inline-flex h-10 items-center gap-1.5 rounded-[10px] border border-line-strong px-3 text-[13px] text-fg-soft hover:bg-white/[0.04] disabled:opacity-40">
          <Plus className="size-4" aria-hidden /> Adicionar
        </button>
      </div>
      <p className="text-xs text-subtle">{value.length}/{max} orientações · Enter adiciona</p>
    </div>
  );
}

/**
 * NumberInput ligado ao react-hook-form que ACEITA as props de acessibilidade injetadas pelo <Field>
 * (id, aria-invalid, aria-describedby) — com <Controller> direto, o rótulo não se ligaria ao campo.
 *   <Field label="Custo"><FormNumber control={form.control} name="costPoints" decimals={0} /></Field>
 */
export function FormNumber<T extends FieldValues>({ control, name, ...props }: {
  control: Control<T>; name: Path<T>;
} & Omit<PropsCampoNumero, 'value' | 'onChange' | 'name'>) {
  return (
    <Controller control={control} name={name}
      render={({ field, fieldState }) => (
        <CampoNumero {...props} name={field.name} ref={field.ref} value={field.value as number | null | undefined}
          onChange={field.onChange} onBlur={field.onBlur} invalido={!!fieldState.error || props.invalido} />
      )} />
  );
}
