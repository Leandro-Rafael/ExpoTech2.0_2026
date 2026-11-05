// Etapa 1 do registro de descarte: escolher/tirar a foto e acompanhar a análise da IA.
import { useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, Camera, ImagePlus, RefreshCw, ScanSearch } from 'lucide-react';
import { Button, ProgressBar } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { PreparedPhoto } from './image';

export type AnalysisPhase = 'idle' | 'preparing' | 'uploading' | 'loading-model' | 'classifying' | 'done' | 'error';

const PHASE_TEXT: Record<AnalysisPhase, string> = {
  idle: '',
  preparing: 'Otimizando a foto…',
  uploading: 'Enviando com segurança…',
  'loading-model': 'Carregando a IA no seu navegador…',
  classifying: 'Identificando o material…',
  done: 'Pronto',
  error: 'Não foi possível concluir',
};

export interface PhotoStepProps {
  photo: PreparedPhoto | null;
  phase: AnalysisPhase;
  modelProgress: number;
  error: string | null;
  onFile: (file: File) => void;
  onRetry: () => void;
  onSkip: () => void;
  onReset: () => void;
}

export function PhotoStep({ photo, phase, modelProgress, error, onFile, onRetry, onSkip, onReset }: PhotoStepProps) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const busy = phase !== 'idle' && phase !== 'done' && phase !== 'error';

  const pick = (files: FileList | null) => {
    const f = files?.[0];
    if (f) onFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files);
  };

  const inputs = (
    <>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { pick(e.target.files); e.target.value = ''; }} />
    </>
  );

  if (!photo) {
    return (
      <div>
        {inputs}
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            'relative flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition-colors',
            dragging ? 'border-fg-soft bg-white/[0.03]' : 'border-line-strong bg-bg-deep/40',
          )}
        >
          <ScanSearch className="size-8 text-fg-soft" strokeWidth={1.4} aria-hidden />
          <h3 className="mt-5 text-lg font-semibold text-fg">Fotografe o resíduo</h3>
          <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-muted">
            Enquadre um item por vez, com boa luz e fundo simples. A IA sugere a categoria e você confirma ou corrige.
          </p>
          <div className="mt-7 flex w-full max-w-sm flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Button size="lg" leftIcon={Camera} onClick={() => cameraRef.current?.click()} className="sm:flex-1">Tirar foto</Button>
            <Button size="lg" variant="secondary" leftIcon={ImagePlus} onClick={() => fileRef.current?.click()} className="sm:flex-1">Escolher arquivo</Button>
          </div>
          <p className="mt-5 hidden text-xs text-subtle sm:block">ou arraste uma imagem para cá · JPEG ou PNG</p>
          {error && (
            <p role="alert" className="mt-5 flex items-center gap-2 text-sm text-danger"><AlertTriangle className="size-4" aria-hidden />{error}</p>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-subtle">A foto é reduzida no seu aparelho e os metadados (como GPS da câmera) são removidos antes do envio.</p>
          <button type="button" onClick={onSkip} className="shrink-0 text-left text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg">
            Continuar sem foto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {inputs}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-bg-deep">
        <img src={photo.previewUrl} alt="Foto do resíduo selecionada" className="mx-auto max-h-[420px] w-full object-contain" />
        {busy && (
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-bg/30" />
            <div className="absolute inset-0 animate-[scan_2.6s_cubic-bezier(0.45,0,0.55,1)_infinite]" style={{ ['--scan-distance' as string]: '100%' }}>
              <div className="absolute inset-x-0 top-0 h-16 -translate-y-full bg-gradient-to-b from-transparent to-brand-400/15" />
              <div className="absolute inset-x-0 top-0 h-px bg-brand-300/80" />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 min-h-[64px]" aria-live="polite">
        {busy && (
          <div>
            <p className="text-sm text-fg-soft">{PHASE_TEXT[phase]}</p>
            {phase === 'loading-model' && (
              <div className="mt-2 max-w-sm">
                <ProgressBar value={modelProgress} size="xs" valueLabel={null} />
                <p className="mt-1.5 font-mono text-[11px] text-subtle tabular">
                  MobileNet v2 · {Math.round(modelProgress * 100)}% de ≈ 14 MB · só na primeira vez, funciona offline
                </p>
              </div>
            )}
          </div>
        )}
        {phase === 'error' && (
          <div role="alert" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{error}</p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" leftIcon={RefreshCw} onClick={onRetry}>Tentar de novo</Button>
              <Button variant="ghost" size="sm" onClick={onReset}>Outra foto</Button>
            </div>
          </div>
        )}
        {phase === 'done' && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">Foto enviada e analisada.</p>
            <Button variant="ghost" size="sm" leftIcon={RefreshCw} onClick={onReset}>Trocar foto</Button>
          </div>
        )}
      </div>
    </div>
  );
}
