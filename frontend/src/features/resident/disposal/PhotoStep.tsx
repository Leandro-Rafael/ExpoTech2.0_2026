// Etapa 1 do registro de descarte: escolher/tirar a foto e acompanhar a análise da IA.
import { useRef, useState, type DragEvent } from 'react';
import { AlertTriangle, Camera, ImagePlus, RefreshCw, ScanSearch } from 'lucide-react';
import { Botao, BarraProgresso } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { FotoPreparada } from './image';

export type FaseAnalise = 'idle' | 'preparing' | 'uploading' | 'loading-model' | 'classifying' | 'done' | 'error';

const TEXTO_FASE: Record<FaseAnalise, string> = {
  idle: '',
  preparing: 'Otimizando a foto…',
  uploading: 'Enviando com segurança…',
  'loading-model': 'Carregando a IA no seu navegador…',
  classifying: 'Identificando o material…',
  done: 'Pronto',
  error: 'Não foi possível concluir',
};

export interface PropsEtapaFoto {
  foto: FotoPreparada | null;
  fase: FaseAnalise;
  progressoModelo: number;
  error: string | null;
  aoEscolherArquivo: (file: File) => void;
  aoTentarDeNovo: () => void;
  aoPular: () => void;
  aoTrocarFoto: () => void;
}

export function EtapaFoto({ foto, fase, progressoModelo, error, aoEscolherArquivo, aoTentarDeNovo, aoPular, aoTrocarFoto }: PropsEtapaFoto) {
  const refCamera = useRef<HTMLInputElement>(null);
  const refArquivo = useRef<HTMLInputElement>(null);
  const [arrastando, setArrastando] = useState(false);
  const ocupado = fase !== 'idle' && fase !== 'done' && fase !== 'error';

  const escolher = (arquivos: FileList | null) => {
    const f = arquivos?.[0];
    if (f) aoEscolherArquivo(f);
  };
  const aoSoltar = (e: DragEvent) => {
    e.preventDefault();
    setArrastando(false);
    escolher(e.dataTransfer.files);
  };

  const entradas = (
    <>
      <input ref={refCamera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { escolher(e.target.files); e.target.value = ''; }} />
      <input ref={refArquivo} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/*" className="sr-only" tabIndex={-1} aria-hidden
        onChange={(e) => { escolher(e.target.files); e.target.value = ''; }} />
    </>
  );

  if (!foto) {
    return (
      <div>
        {entradas}
        <div
          onDragOver={(e) => { e.preventDefault(); setArrastando(true); }}
          onDragLeave={() => setArrastando(false)}
          onDrop={aoSoltar}
          className={cn(
            'relative flex min-h-[340px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-12 text-center transition-colors',
            arrastando ? 'border-fg-soft bg-white/[0.03]' : 'border-line-strong bg-bg-deep/40',
          )}
        >
          <ScanSearch className="size-8 text-fg-soft" strokeWidth={1.4} aria-hidden />
          <h3 className="mt-5 text-lg font-semibold text-fg">Fotografe o resíduo</h3>
          <p className="mt-2 max-w-[44ch] text-sm leading-relaxed text-muted">
            Enquadre um item por vez, com boa luz e fundo simples. A IA sugere a categoria e você confirma ou corrige.
          </p>
          <div className="mt-7 flex w-full max-w-sm flex-col gap-2.5 sm:flex-row sm:justify-center">
            <Botao size="lg" iconeEsquerda={Camera} onClick={() => refCamera.current?.click()} className="sm:flex-1">Tirar foto</Botao>
            <Botao size="lg" variant="secondary" iconeEsquerda={ImagePlus} onClick={() => refArquivo.current?.click()} className="sm:flex-1">Escolher arquivo</Botao>
          </div>
          <p className="mt-5 hidden text-xs text-subtle sm:block">ou arraste uma imagem para cá · JPEG ou PNG</p>
          {error && (
            <p role="alert" className="mt-5 flex items-center gap-2 text-sm text-danger"><AlertTriangle className="size-4" aria-hidden />{error}</p>
          )}
        </div>
        <div className="mt-4 flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-subtle">A foto é reduzida no seu aparelho e os metadados (como GPS da câmera) são removidos antes do envio.</p>
          <button type="button" onClick={aoPular} className="shrink-0 text-left text-sm text-muted underline decoration-line-strong underline-offset-4 hover:text-fg">
            Continuar sem foto
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {entradas}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-bg-deep">
        <img src={foto.previewUrl} alt="Foto do resíduo selecionada" className="mx-auto max-h-[420px] w-full object-contain" />
        {ocupado && (
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
        {ocupado && (
          <div>
            <p className="text-sm text-fg-soft">{TEXTO_FASE[fase]}</p>
            {fase === 'loading-model' && (
              <div className="mt-2 max-w-sm">
                <BarraProgresso value={progressoModelo} size="xs" rotuloValor={null} />
                <p className="mt-1.5 font-mono text-[11px] text-subtle tabular">
                  MobileNet v2 · {Math.round(progressoModelo * 100)}% de ≈ 14 MB · só na primeira vez, funciona offline
                </p>
              </div>
            )}
          </div>
        )}
        {fase === 'error' && (
          <div role="alert" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="flex items-start gap-2 text-sm text-danger"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{error}</p>
            <div className="flex gap-2">
              <Botao variant="secondary" size="sm" iconeEsquerda={RefreshCw} onClick={aoTentarDeNovo}>Tentar de novo</Botao>
              <Botao variant="ghost" size="sm" onClick={aoTrocarFoto}>Outra foto</Botao>
            </div>
          </div>
        )}
        {fase === 'done' && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">Foto enviada e analisada.</p>
            <Botao variant="ghost" size="sm" iconeEsquerda={RefreshCw} onClick={aoTrocarFoto}>Trocar foto</Botao>
          </div>
        )}
      </div>
    </div>
  );
}
