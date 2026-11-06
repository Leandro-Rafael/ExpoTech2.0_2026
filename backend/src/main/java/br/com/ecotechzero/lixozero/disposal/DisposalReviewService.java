package br.com.ecotechzero.lixozero.disposal;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.category.CategoryRepository;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.common.PageResponse;
import br.com.ecotechzero.lixozero.common.Pagination;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.ApproveRequest;
import br.com.ecotechzero.lixozero.disposal.DisposalDtos.DisposalDto;
import br.com.ecotechzero.lixozero.gamification.GamificationService;
import br.com.ecotechzero.lixozero.points.PointTransactionType;
import br.com.ecotechzero.lixozero.points.PointsService;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

/**
 * Moderação de descartes pelo administrador.
 * <p>
 * Regras garantidas: apenas descartes APROVADOS geram pontos, e cada descarte gera pontos UMA única vez.
 * Defesa em camadas: (1) lock pessimista na linha do descarte; (2) aprovar um descarte já aprovado
 * devolve o mesmo resultado sem pontuar de novo (idempotente); (3) índice único no banco impede dois
 * lançamentos EARN para o mesmo descarte, mesmo que tudo o mais falhe.
 */
@Service
public class DisposalReviewService {

    private final DisposalRepository descartes;
    private final CategoryRepository categorias;
    private final UserRepository usuarios;
    private final PointsService pontos;
    private final GamificationService gamificacao;
    private final AuditService auditoria;
    private final EntityManager em;
    private final Clock relogio;

    public DisposalReviewService(DisposalRepository descartes, CategoryRepository categorias, UserRepository usuarios,
                                 PointsService pontos, GamificationService gamificacao, AuditService auditoria,
                                 EntityManager em, Clock relogio) {
        this.descartes = descartes;
        this.categorias = categorias;
        this.usuarios = usuarios;
        this.pontos = pontos;
        this.gamificacao = gamificacao;
        this.auditoria = auditoria;
        this.em = em;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public PageResponse<DisposalDto> fila(DisposalStatus situacao, Boolean sinalizado, Integer pagina, Integer tamanho) {
        Boolean filtroSinalizado = Boolean.TRUE.equals(sinalizado) ? Boolean.TRUE : null;
        Sort ordenacao = Sort.by(Sort.Direction.DESC, "createdAt");
        return PageResponse.of(descartes.adminSearch(situacao, filtroSinalizado, Pagination.criar(pagina, tamanho, ordenacao)), d -> DisposalDto.of(d, true));
    }

    @Transactional
    public DisposalDto aprovar(AuthUser admin, UUID id, ApproveRequest pedido) {
        // 1. Trava a linha do descarte: se dois admins clicarem juntos, um espera o outro.
        Disposal descarte = travar(id);
        // 2. Se já foi aprovado, devolve como está (não pontua de novo); recusado não pode virar aprovado.
        if (descarte.getStatus() == DisposalStatus.APPROVED) {
            return DisposalDto.of(descarte, true); // idempotente: não pontua de novo
        }
        if (descarte.getStatus() == DisposalStatus.REJECTED) {
            throw ApiException.conflito("Este descarte já foi recusado e não pode ser aprovado.");
        }
        // 3. Admin não pode aprovar o próprio descarte.
        if (descarte.getUser().getId().equals(admin.id())) {
            throw ApiException.regraNegocio("Você não pode aprovar o seu próprio descarte.");
        }
        // 4. Aplica a correção de categoria/kg feita pelo admin, se houver.
        String textoCorrecao = aplicarCorrecao(descarte, pedido);
        // 5. Aprova, credita os pontos e registra na auditoria.
        int concedidos = aprovarInterno(descarte, usuarios.getReferenceById(admin.id()));
        auditoria.registrar(AuditAction.DISPOSAL_APPROVED, "Disposal", id, "+" + concedidos + " pontos" + textoCorrecao);
        return DisposalDto.of(descarte, true);
    }

    @Transactional
    public DisposalDto recusar(AuthUser admin, UUID id, String motivo) {
        // 1. Mesma trava da aprovação.
        Disposal descarte = travar(id);
        // 2. Já aprovado não pode ser recusado (os pontos já foram dados).
        if (descarte.getStatus() == DisposalStatus.REJECTED) {
            return DisposalDto.of(descarte, true);
        }
        if (descarte.getStatus() == DisposalStatus.APPROVED) {
            throw ApiException.conflito("Este descarte já foi aprovado e não pode ser recusado.");
        }
        // 3. Motivo é obrigatório: o morador vê no histórico.
        String motivoLimpo = Text.limpar(motivo);
        if (motivoLimpo == null || motivoLimpo.length() < 3) {
            throw ApiException.campo("reason", "informe o motivo da recusa");
        }
        // 4. Marca como recusado e registra na auditoria.
        descarte.reject(Text.truncar(motivoLimpo, 300), usuarios.getReferenceById(admin.id()), relogio.instant());
        auditoria.registrar(AuditAction.DISPOSAL_REJECTED, "Disposal", id, motivoLimpo);
        return DisposalDto.of(descarte, true);
    }

    /**
     * Aprova e credita os pontos (usado pela moderação e pela aprovação automática).
     * O crédito é feito com a linha do usuário travada; o índice único garante pontuação única.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public int aprovarInterno(Disposal descarte, User revisor) {
        Instant agora = relogio.instant();
        Category categoria = descarte.getCategory();
        // bônus reavaliado AGORA, com a categoria final (o admin pode ter corrigido)
        int concedidos = PointsCalculator.calcular(categoria.getPointsPerKg(), descarte.getQuantityKg(), descarte.aiBonusApplies());
        descarte.approve(concedidos, revisor, agora);
        // o extrato de pontos é encadeado por HMAC (assinatura que denuncia se alguém alterar o histórico)
        String descricao = String.format(Locale.forLanguageTag("pt-BR"), "Descarte aprovado: %.2f kg de %s",
                descarte.getQuantityKg(), categoria.getName());
        pontos.creditar(descarte.getUser().getId(), concedidos, PointTransactionType.EARN, descricao, descarte, null, agora);
        gamificacao.aoAprovarDescarte(descarte.getUser().getId(), descarte.getDisposedAt());
        return concedidos;
    }

    private String aplicarCorrecao(Disposal descarte, ApproveRequest pedido) {
        if (pedido == null || (pedido.categoryId() == null && pedido.quantityKg() == null)) {
            return "";
        }
        Category categoria = pedido.categoryId() == null ? descarte.getCategory()
                : categorias.findById(pedido.categoryId()).orElseThrow(() -> ApiException.campo("categoryId", "categoria não encontrada"));
        double kg = pedido.quantityKg() == null ? descarte.getQuantityKg() : Numbers.arredondar(pedido.quantityKg(), 3);
        if (kg > categoria.getMaxKgPerDisposal()) {
            throw ApiException.campo("quantityKg", "máximo de " + categoria.getMaxKgPerDisposal() + " kg para " + categoria.getName());
        }
        String nota = " (corrigido: " + descarte.getCategory().getCode() + " " + descarte.getQuantityKg() + " kg -> "
                + categoria.getCode() + " " + kg + " kg)";
        descarte.correct(categoria, kg);
        return nota;
    }

    // lock pessimista (SELECT ... FOR UPDATE): ninguém mais altera a linha até a transação terminar
    private Disposal travar(UUID id) {
        Disposal descarte = descartes.findById(id).orElseThrow(() -> ApiException.naoEncontrado("Descarte não encontrado."));
        em.refresh(descarte, LockModeType.PESSIMISTIC_WRITE);
        return descarte;
    }
}
