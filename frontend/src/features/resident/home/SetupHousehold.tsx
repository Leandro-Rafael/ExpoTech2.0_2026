import { lazy, Suspense, useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Crosshair, KeyRound, LocateFixed, MapPinned, Plus } from 'lucide-react';
import { applyServerErrors } from '@/api';
import { useCreateHousehold, useJoinHousehold } from '@/api/queries';
import { Button, Field, FormError, Input, NumberInput, Skeleton, toast } from '@/components/ui';
import { useGeolocation } from '@/hooks/useGeolocation';
import { formatNumber } from '@/lib/format';

// Leaflet só carrega se a pessoa abrir o mapa.
const LocationPicker = lazy(() => import('@/components/map').then((m) => ({ default: m.LocationPicker })));

const createSchema = z.object({
  name: z.string().trim().min(2, 'Mínimo de 2 caracteres').max(80, 'Máximo de 80 caracteres'),
  neighborhood: z.string().trim().min(2, 'Informe o bairro').max(80, 'Máximo de 80 caracteres'),
  city: z.string().trim().min(2, 'Informe a cidade').max(80, 'Máximo de 80 caracteres'),
  address: z.string().trim().max(200, 'Máximo de 200 caracteres').optional(),
  latitude: z.number().min(-90).max(90).nullable(),
  longitude: z.number().min(-180).max(180).nullable(),
}).refine((v) => (v.latitude == null) === (v.longitude == null), { path: ['latitude'], message: 'Informe latitude e longitude juntas' });
type CreateValues = z.infer<typeof createSchema>;

const joinSchema = z.object({
  inviteCode: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,12}$/, 'O código tem de 6 a 12 letras e números'),
});
type JoinValues = z.infer<typeof joinSchema>;

/ Aparece em "Minha casa" para quem ainda não tem residência: criar uma nova ou entrar com um código.
export function SetupHousehold() {
  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
      <CreateForm />
      <div className="lg:border-l lg:border-line lg:pl-16">
        <JoinForm />
        <div className="mt-12 border-t border-line pt-8">
          <p className="label-mono">Como funciona</p>
          <ol className="mt-4 space-y-4 text-sm leading-relaxed text-muted">
            <li className="flex gap-3"><span className="font-mono text-xs text-subtle tabular">01</span><span>Crie a residência e compartilhe o código com quem mora com você. Os pontos de todos somam no ranking de residências.</span></li>
            <li className="flex gap-3"><span className="font-mono text-xs text-subtle tabular">02</span><span>Conecte lixeiras inteligentes: um sensor mede o nível e a bateria e envia leituras para a plataforma.</span></li>
            <li className="flex gap-3"><span className="font-mono text-xs text-subtle tabular">03</span><span>Quando uma lixeira passa do limite definido, a coleta é pedida automaticamente para o endereço da casa.</span></li>
          </ol>
        </div>
      </div>
    </div>
  );
}

function CreateForm() {
  const create = useCreateHousehold();
  const geo = useGeolocation();
  const [showMap, setShowMap] = useState(false);
  const form = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { name: '', neighborhood: '', city: 'Taboão da Serra', address: '', latitude: null, longitude: null },
  });
  const { register, control, handleSubmit, setValue, setError, watch, formState: { errors, isSubmitting } } = form;
  const lat = watch('latitude');
  const lon = watch('longitude');

  const useMyLocation = () => {
    geo.request();
    setShowMap(true);
  };
  // Aplica a posição do GPS quando chegar.
  useEffect(() => {
    if (geo.status === 'success' && geo.latitude != null && geo.longitude != null) {
      setValue('latitude', Math.round(geo.latitude * 1e6) / 1e6, { shouldDirty: true });
      setValue('longitude', Math.round(geo.longitude * 1e6) / 1e6, { shouldDirty: true });
    }
  }, [geo.status, geo.latitude, geo.longitude, setValue]);

  const onSubmit = handleSubmit(async (v) => {
    try {
      await create.mutateAsync({
        name: v.name, neighborhood: v.neighborhood, city: v.city,
        address: v.address || null, latitude: v.latitude, longitude: v.longitude,
      });
      toast.success('Residência criada! Compartilhe o código de convite com sua família.');
    } catch (e) { applyServerErrors(e, setError, { knownFields: ['name', 'neighborhood', 'city', 'address', 'latitude', 'longitude'] }); }
  });

  return (
    <section aria-labelledby="create-h">
      <h2 id="create-h" className="text-[clamp(1.5rem,1.3rem+0.6vw,1.875rem)] leading-tight text-fg">Criar uma residência</h2>
      <p className="mt-2 max-w-[56ch] text-sm leading-relaxed text-muted">Você será o responsável e poderá conectar lixeiras inteligentes. O endereço e a localização são usados só para as coletas automáticas.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-5">
        <FormError error={errors.root?.server} />
        <Field label="Nome da residência" required error={errors.name} hint="Ex.: Casa da Família Souza, Apto 42">
          <Input {...register('name')} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Bairro" required error={errors.neighborhood}><Input {...register('neighborhood')} autoComplete="address-level3" /></Field>
          <Field label="Cidade" required error={errors.city}><Input {...register('city')} autoComplete="address-level2" /></Field>
        </div>
        <Field label="Endereço" optional error={errors.address} hint="Rua e número, para o coletor encontrar a casa.">
          <Input {...register('address')} autoComplete="street-address" />
        </Field>

        <fieldset className="space-y-3">
          <legend className="mb-1.5 text-sm font-medium text-fg-soft">Localização no mapa <span className="font-normal text-subtle">(opcional)</span></legend>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" leftIcon={geo.status === 'loading' ? Crosshair : LocateFixed} onClick={useMyLocation} loading={geo.status === 'loading'}>Usar minha localização</Button>
            <Button size="sm" variant="ghost" leftIcon={MapPinned} onClick={() => setShowMap((s) => !s)} aria-expanded={showMap}>{showMap ? 'Ocultar mapa' : 'Escolher no mapa'}</Button>
          </div>
          {geo.error && geo.status === 'error' && <p className="text-xs text-warning">{geo.error}</p>}
          {showMap && (
            <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
              <LocationPicker className="h-64" value={lat != null && lon != null ? { latitude: lat, longitude: lon } : null}
                onChange={(p) => { setValue('latitude', p.latitude, { shouldDirty: true }); setValue('longitude', p.longitude, { shouldDirty: true }); }} />
            </Suspense>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" error={errors.latitude}>
              {(a11y) => <Controller control={control} name="latitude" render={({ field }) => (
                <NumberInput {...field} {...a11y} decimals={6} min={-90} max={90} allowNegative inputSize="sm" placeholder="-23,6" />
              )} />}
            </Field>
            <Field label="Longitude" error={errors.longitude}>
              {(a11y) => <Controller control={control} name="longitude" render={({ field }) => (
                <NumberInput {...field} {...a11y} decimals={6} min={-180} max={180} allowNegative inputSize="sm" placeholder="-46,7" />
              )} />}
            </Field>
          </div>
          {lat != null && lon != null && <p className="font-mono text-[11px] text-subtle tabular">Ponto definido: {formatNumber(lat, 5)}, {formatNumber(lon, 5)}</p>}
        </fieldset>

        <Button type="submit" size="lg" leftIcon={Plus} loading={isSubmitting}>Criar residência</Button>
      </form>
    </section>
  );
}

function JoinForm() {
  const join = useJoinHousehold();
  const form = useForm<JoinValues>({ resolver: zodResolver(joinSchema), defaultValues: { inviteCode: '' } });
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = form;
  const onSubmit = handleSubmit(async (v) => {
    try {
      const h = await join.mutateAsync(v.inviteCode);
      toast.success(`Bem-vindo(a) à ${h.name}!`);
    } catch (e) { applyServerErrors(e, setError, { knownFields: ['inviteCode'] }); }
  });
  return (
    <section aria-labelledby="join-h">
      <h2 id="join-h" className="text-[clamp(1.5rem,1.3rem+0.6vw,1.875rem)] leading-tight text-fg">Já tem um convite?</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">Peça o código a quem criou a residência — ele aparece na página “Minha casa”.</p>
      <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
        <FormError error={errors.root?.server} />
        <Field label="Código de convite" required error={errors.inviteCode}>
          <Input {...register('inviteCode')} leftIcon={KeyRound} autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={12}
            placeholder="ABC123XY" className="font-mono tracking-[0.12em] uppercase" />
        </Field>
        <Button type="submit" variant="secondary" loading={isSubmitting}>Entrar na residência</Button>
      </form>
    </section>
  );
}
