package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.ai.OrigemIa;
import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.category.ServicoCategorias;
import br.com.ecotechzero.lixozero.collection.CollectionPoint;
import br.com.ecotechzero.lixozero.collection.ServicoEcopontos;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.common.RespostaPaginada;
import br.com.ecotechzero.lixozero.common.Paginacao;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.disposal.DtosDescarte.CreateDisposalRequest;
import br.com.ecotechzero.lixozero.disposal.DtosDescarte.DisposalDto;
import br.com.ecotechzero.lixozero.fraud.ContextoFraude;
import br.com.ecotechzero.lixozero.fraud.MotorFraude;
import br.com.ecotechzero.lixozero.photo.PhotoMeta;
import br.com.ecotechzero.lixozero.photo.RepositorioFotos;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

/**
 * Registro de descartes pelo morador: validação completa, avaliação antifraude e idempotência.
 * O descarte nasce PENDENTE; pontos só são concedidos na aprovação ({@link ServicoRevisaoDescartes}).
 */
@Service
public class ServicoDescartes {

    private static final Pattern FORMATO_CHAVE_IDEMPOTENCIA = Pattern.compile("^[A-Za-z0-9_-]{8,64}$");
    private static final Duration IDADE_MAXIMA = Duration.ofDays(7);
    private static final Duration TOLERANCIA_RELOGIO = Duration.ofMinutes(5);
    /** Limites da aprovação automática (quando APP_AUTO_APPROVE=true). */
    private static final int APROVACAO_AUTOMATICA_RISCO_MAXIMO = 20;
    private static final double APROVACAO_AUTOMATICA_KG_MAXIMO = 5;

    private final RepositorioDescartes descartes;
    private final ServicoCategorias categorias;
    private final ServicoEcopontos ecopontos;
    private final RepositorioFotos fotos;
    private final RepositorioUsuarios usuarios;
    private final MotorFraude motorFraude;
    private final ServicoRevisaoDescartes moderacao;
    private final ServicoAuditoria auditoria;
    private final LimitadorDeTaxa limitador;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ServicoDescartes(RepositorioDescartes descartes, ServicoCategorias categorias, ServicoEcopontos ecopontos,
                           RepositorioFotos fotos, RepositorioUsuarios usuarios, MotorFraude motorFraude, ServicoRevisaoDescartes moderacao,
                           ServicoAuditoria auditoria, LimitadorDeTaxa limitador, PropriedadesApp propriedades, Clock relogio) {
        this.descartes = descartes;
        this.categorias = categorias;
        this.ecopontos = ecopontos;
        this.fotos = fotos;
        this.usuarios = usuarios;
        this.motorFraude = motorFraude;
        this.moderacao = moderacao;
        this.auditoria = auditoria;
        this.limitador = limitador;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    /** Valida o formato do header Idempotency-Key (opcional). */
    public static String validarChaveIdempotencia(String chave) {
        if (chave == null || chave.isBlank()) {
            return null;
        }
        if (!FORMATO_CHAVE_IDEMPOTENCIA.matcher(chave.strip()).matches()) {
            throw ExcecaoApi.campo("Idempotency-Key", "use de 8 a 64 caracteres (letras, números, - ou _)");
        }
        return chave.strip();
    }

    /** Mesmo usuário + mesma chave = devolve o descarte original (clique duplo, nova tentativa de rede). */
    @Transactional(readOnly = true)
    public Optional<DisposalDto> buscarPorChaveIdempotencia(UUID usuarioId, String chave) {
        if (chave == null) {
            return Optional.empty();
        }
        return descartes.findByUserIdAndIdempotencyKey(usuarioId, chave).map(d -> DisposalDto.of(d, false));
    }

    @Transactional
    public DisposalDto criar(UsuarioAutenticado logado, CreateDisposalRequest entrada, String chaveIdempotencia) {
        // 1. Mesma Idempotency-Key = mesmo descarte (clique duplo ou reenvio); depois, limite de frequência.
        Optional<DisposalDto> existente = buscarPorChaveIdempotencia(logado.id(), chaveIdempotencia);
        if (existente.isPresent()) {
            return existente.get();
        }
        limitador.verificar(LimitadorDeTaxa.Policy.DISPOSAL_USER, logado.id().toString());
        Instant agora = relogio.instant();

        // 2. Valida categoria, peso, localização e data (até 7 dias atrás).
        Category categoria = categorias.exigirAtiva(entrada.categoryId(), "categoryId");
        double kg = Numeros.arredondar(entrada.quantityKg(), 3);
        if (kg < 0.01) {
            throw ExcecaoApi.campo("quantityKg", "a quantidade mínima é 0,01 kg");
        }
        if (kg > categoria.getMaxKgPerDisposal()) {
            throw ExcecaoApi.campo("quantityKg", "máximo de " + categoria.getMaxKgPerDisposal() + " kg por descarte de " + categoria.getName());
        }
        if ((entrada.latitude() == null) != (entrada.longitude() == null)) {
            throw ExcecaoApi.campo("latitude", "informe latitude e longitude juntas");
        }
        Instant dataDescarte = entrada.disposedAt() == null ? agora : entrada.disposedAt();
        if (dataDescarte.isAfter(agora.plus(TOLERANCIA_RELOGIO))) {
            throw ExcecaoApi.campo("disposedAt", "a data do descarte não pode ser no futuro");
        }
        if (dataDescarte.isBefore(agora.minus(IDADE_MAXIMA))) {
            throw ExcecaoApi.campo("disposedAt", "só é possível registrar descartes dos últimos 7 dias");
        }

        // 3. Confere foto e ecoponto, se vieram.
        PhotoMeta foto = null;
        if (entrada.photoId() != null) {
            // foto de outra pessoa = 404 (não revela que existe); reuso também é barrado pelo UNIQUE(photo_id) no banco
            foto = fotos.findMeta(entrada.photoId())
                    .filter(p -> p.ownerId().equals(logado.id()))
                    .orElseThrow(() -> ExcecaoApi.naoEncontrado("Foto não encontrada."));
            if (descartes.existsByPhotoId(foto.id())) {
                throw ExcecaoApi.campo("photoId", "esta foto já foi usada em outro descarte");
            }
        }
        CollectionPoint ecoponto = null;
        if (entrada.collectionPointId() != null) {
            ecoponto = ecopontos.exigirAtivo(entrada.collectionPointId(), "collectionPointId");
            if (!ecoponto.accepts(categoria.getCode())) {
                throw ExcecaoApi.campo("collectionPointId", "este ecoponto não recebe " + categoria.getName().toLowerCase());
            }
        }

        // IA: só vale o que o SERVIDOR gravou na foto no upload. Os campos ai* do corpo são apenas um palpite
        // do navegador (informativo): nunca dão bônus, nunca reduzem o risco e nunca se passam por IA do servidor.
        CodigoCategoria codigoPalpite = entrada.aiSuggestedCode();
        Double confiancaPalpite = entrada.aiConfidence() == null ? null : Math.clamp(entrada.aiConfidence(), 0.0, 1.0);
        OrigemIa origemPalpite = entrada.aiSource() == OrigemIa.MANUAL ? OrigemIa.MANUAL
                : (codigoPalpite != null || entrada.aiSource() != null ? OrigemIa.LOCAL : null);
        boolean iaDoServidor = foto != null && foto.aiVerified();
        // o bônus exige foto recente (tirada para ESTE descarte, não guardada de outro dia)
        boolean temDireitoBonus = iaDoServidor && foto.createdAt() != null
                && !foto.createdAt().isBefore(agora.minus(CalculadoraPontos.IDADE_MAXIMA_FOTO_IA));

        // 4. Calcula o risco de fraude (regras do pacote fraud/).
        var fraude = motorFraude.avaliar(new ContextoFraude(logado.id(), categoria.getCode(), categoria.getMaxKgPerDisposal(), kg, foto,
                entrada.latitude(), entrada.longitude(), dataDescarte,
                iaDoServidor ? foto.aiCode() : null, iaDoServidor ? foto.aiConfidence() : null,
                codigoPalpite, confiancaPalpite, origemPalpite, agora, propriedades.zoneId()));

        // 5. Monta e grava o descarte como PENDENTE, com os pontos só estimados.
        Disposal descarte = new Disposal(usuarios.getReferenceById(logado.id()), categoria, kg, dataDescarte);
        descarte.setLocation(entrada.latitude(), entrada.longitude());
        descarte.setCollectionPoint(ecoponto);
        if (foto != null) {
            descarte.setPhoto(fotos.getReferenceById(foto.id()));
        }
        if (temDireitoBonus) {
            descarte.recordServerAi(foto.aiCode(), foto.aiConfidence(), foto.aiSource());
        }
        descarte.recordClientHint(codigoPalpite, confiancaPalpite, origemPalpite);
        descarte.setNotes(Textos.truncar(Textos.limpar(entrada.notes()), 500));
        descarte.setIdempotencyKey(chaveIdempotencia);
        descarte.setFraud(fraude.score(), fraude.flags(), fraude.flagged());
        descarte.setEstimatedPoints(CalculadoraPontos.calcular(categoria.getPointsPerKg(), kg, descarte.aiBonusApplies()));
        descartes.saveAndFlush(descarte);

        // 6. Suspeito vai para a auditoria; baixo risco pode ser aprovado na hora se APP_AUTO_APPROVE estiver ligado.
        if (fraude.flagged()) {
            auditoria.registrar(AcaoAuditoria.DISPOSAL_FLAGGED, "Disposal", descarte.getId(), "risco " + fraude.score() + ": " + String.join("; ", fraude.flags()));
        } else if (propriedades.autoApprove() && fraude.score() < APROVACAO_AUTOMATICA_RISCO_MAXIMO && kg <= APROVACAO_AUTOMATICA_KG_MAXIMO && foto != null) {
            int concedidos = moderacao.aprovarInterno(descarte, null);
            auditoria.registrar(AcaoAuditoria.DISPOSAL_AUTO_APPROVED, "Disposal", descarte.getId(), "+" + concedidos + " pontos (baixo risco)");
        }
        return DisposalDto.of(descarte, false);
    }

    @Transactional(readOnly = true)
    public RespostaPaginada<DisposalDto> listarMeus(UUID usuarioId, StatusDescarte situacao, Integer pagina, Integer tamanho) {
        var paginacao = Paginacao.criar(pagina, tamanho, Sort.by(Sort.Direction.DESC, "createdAt"));
        var resultado = situacao == null ? descartes.findByUserId(usuarioId, paginacao) : descartes.findByUserIdAndStatus(usuarioId, situacao, paginacao);
        return RespostaPaginada.of(resultado, d -> DisposalDto.of(d, false));
    }

    /** Detalhe: o dono vê o próprio descarte; o admin vê qualquer um (com dados antifraude). Outros: 404. */
    @Transactional(readOnly = true)
    public DisposalDto buscar(UsuarioAutenticado logado, UUID id) {
        Disposal d = descartes.findById(id)
                .filter(x -> logado.isAdmin() || x.getUser().getId().equals(logado.id()))
                .orElseThrow(() -> ExcecaoApi.naoEncontrado("Descarte não encontrado."));
        return DisposalDto.of(d, logado.isAdmin());
    }
}
