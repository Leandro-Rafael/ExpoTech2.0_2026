package br.com.ecotechzero.lixozero.reward;

import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.CodigoErro;
import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa;
import br.com.ecotechzero.lixozero.points.ServicoPontos;
import br.com.ecotechzero.lixozero.reward.DtosRecompensa.RedemptionDto;
import br.com.ecotechzero.lixozero.reward.DtosRecompensa.RewardDto;
import br.com.ecotechzero.lixozero.reward.DtosRecompensa.RewardInput;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.util.List;
import java.util.UUID;

/**
 * Catálogo e resgate de recompensas.
 * O resgate verifica SALDO e ESTOQUE de forma atômica: trava a linha do usuário e depois a da recompensa
 * (sempre nessa ordem, evitando deadlock), confere, debita e grava o voucher na mesma transação.
 */
@Service
public class ServicoRecompensas {

    private static final String ALFABETO_VOUCHER = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final RepositorioRecompensas recompensas;
    private final RepositorioResgates resgates;
    private final ServicoPontos pontos;
    private final EntityManager em;
    private final ServicoAuditoria auditoria;
    private final LimitadorDeTaxa limitador;
    private final Clock relogio;

    public ServicoRecompensas(RepositorioRecompensas recompensas, RepositorioResgates resgates, ServicoPontos pontos, EntityManager em,
                         ServicoAuditoria auditoria, LimitadorDeTaxa limitador, Clock relogio) {
        this.recompensas = recompensas;
        this.resgates = resgates;
        this.pontos = pontos;
        this.em = em;
        this.auditoria = auditoria;
        this.limitador = limitador;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public List<RewardDto> listarAtivas() {
        return recompensas.findByActiveTrueOrderByCostPoints().stream().map(RewardDto::of).toList();
    }

    @Transactional(readOnly = true)
    public List<RewardDto> listarTodas() {
        return recompensas.findAllByOrderByCostPoints().stream().map(RewardDto::of).toList();
    }

    @Transactional
    public RedemptionDto resgatar(UUID usuarioId, UUID recompensaId) {
        // 1. Limite de frequência por usuário.
        limitador.verificar(LimitadorDeTaxa.Policy.REDEEM_USER, usuarioId.toString());
        // 2. Trava o usuário e depois a recompensa: dois resgates ao mesmo tempo não gastam o mesmo saldo
        //    nem a última unidade do estoque.
        User usuario = pontos.travarUsuario(usuarioId); // 1º lock: usuário
        Reward recompensa = em.find(Reward.class, recompensaId);
        if (recompensa == null) {
            throw ExcecaoApi.naoEncontrado("Recompensa não encontrada.");
        }
        em.refresh(recompensa, LockModeType.PESSIMISTIC_WRITE); // 2º lock: recompensa
        // 3. Confere se está ativa, se tem estoque e se o saldo cobre o custo.
        if (!recompensa.isActive()) {
            throw ExcecaoApi.naoEncontrado("Recompensa não encontrada.");
        }
        if (recompensa.getStock() <= 0) {
            throw new ExcecaoApi(CodigoErro.OUT_OF_STOCK, "Esta recompensa está esgotada.");
        }
        if (usuario.getPoints() < recompensa.getCostPoints()) {
            throw new ExcecaoApi(CodigoErro.INSUFFICIENT_POINTS,
                    "Saldo insuficiente: você tem " + usuario.getPoints() + " pontos e a recompensa custa " + recompensa.getCostPoints() + ".");
        }
        // 4. Baixa o estoque e grava o resgate com um código de voucher único (LZ50-XXXX-XXXX).
        recompensa.decrementStock();
        Redemption resgate = resgates.save(new Redemption(usuario, recompensa, recompensa.getCostPoints(), novoCodigoVoucher()));
        // 5. Debita os pontos no extrato e registra na auditoria.
        pontos.debitar(usuarioId, recompensa.getCostPoints(), "Resgate: " + recompensa.getName(), resgate, relogio.instant());
        auditoria.registrar(AcaoAuditoria.REWARD_REDEEMED, "Redemption", resgate.getId(), recompensa.getName() + " (" + recompensa.getCostPoints() + " pts)");
        return RedemptionDto.of(resgate);
    }

    @Transactional(readOnly = true)
    public List<RedemptionDto> historico(UUID usuarioId) {
        return resgates.findByUserIdOrderByCreatedAtDesc(usuarioId).stream().map(RedemptionDto::of).toList();
    }

    @Transactional
    public RewardDto criar(RewardInput entrada) {
        Reward recompensa = new Reward(entrada.name());
        recompensa.apply(entrada);
        recompensas.save(recompensa);
        auditoria.registrar(AcaoAuditoria.REWARD_CREATED, "Reward", recompensa.getId(), recompensa.getName());
        return RewardDto.of(recompensa);
    }

    @Transactional
    public RewardDto atualizar(UUID id, RewardInput entrada) {
        Reward recompensa = recompensas.findById(id).orElseThrow(() -> ExcecaoApi.naoEncontrado("Recompensa não encontrada."));
        recompensa.apply(entrada);
        auditoria.registrar(AcaoAuditoria.REWARD_UPDATED, "Reward", id, recompensa.getName());
        return RewardDto.of(recompensa);
    }

    /** Voucher no formato LZ50-XXXX-XXXX gerado com SecureRandom (imprevisível). */
    String novoCodigoVoucher() {
        for (int tentativa = 0; tentativa < 10; tentativa++) {
            StringBuilder sb = new StringBuilder("LZ50-");
            for (int i = 0; i < 8; i++) {
                if (i == 4) sb.append('-');
                sb.append(ALFABETO_VOUCHER.charAt(ALEATORIO.nextInt(ALFABETO_VOUCHER.length())));
            }
            String codigo = sb.toString();
            if (!resgates.existsByCode(codigo)) {
                return codigo;
            }
        }
        throw new IllegalStateException("Não foi possível gerar um voucher único");
    }
}
