package br.com.ecotechzero.lixozero.points;

import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.CodigoErro;
import br.com.ecotechzero.lixozero.common.RespostaPaginada;
import br.com.ecotechzero.lixozero.common.Paginacao;
import br.com.ecotechzero.lixozero.disposal.Disposal;
import br.com.ecotechzero.lixozero.gamification.Challenge;
import br.com.ecotechzero.lixozero.integrity.CadeiaExtrato;
import br.com.ecotechzero.lixozero.reward.Redemption;
import br.com.ecotechzero.lixozero.user.User;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

/**
 * Único ponto do sistema que altera saldos de pontos.
 * <p>
 * Toda operação trava a linha do usuário (SELECT ... FOR UPDATE) antes de ler o saldo. Assim, duas
 * operações simultâneas (ex.: dois resgates em abas diferentes) são executadas uma após a outra e
 * o saldo nunca fica inconsistente nem negativo (há também um CHECK points >= 0 no banco).
 * Cada lançamento entra no fim da cadeia de integridade do usuário ({@link CadeiaExtrato}).
 */
@Service
public class ServicoPontos {

    private final EntityManager em;
    private final RepositorioTransacoesPontos transacoes;
    private final CadeiaExtrato extrato;

    public ServicoPontos(EntityManager em, RepositorioTransacoesPontos transacoes, CadeiaExtrato extrato) {
        this.em = em;
        this.transacoes = transacoes;
        this.extrato = extrato;
    }

    public record PointTransactionDto(UUID id, PointTransactionType type, int amount, long balanceAfter,
                                      String description, Instant createdAt) {
        static PointTransactionDto of(PointTransaction t) {
            return new PointTransactionDto(t.getId(), t.getType(), t.getAmount(), t.getBalanceAfter(), t.getDescription(), t.getCreatedAt());
        }
    }

    /** Trava o usuário para atualização e recarrega o estado mais recente do banco. */
    @Transactional(propagation = Propagation.MANDATORY)
    public User travarUsuario(UUID idUsuario) {
        User usuario = em.find(User.class, idUsuario);
        if (usuario == null) {
            throw ExcecaoApi.naoEncontrado("Usuário não encontrado.");
        }
        em.refresh(usuario, LockModeType.PESSIMISTIC_WRITE);
        return usuario;
    }

    /** Credita pontos ganhos (EARN por descarte aprovado ou BONUS por desafio). */
    @Transactional(propagation = Propagation.MANDATORY)
    public UUID creditar(UUID idUsuario, int quantidade, PointTransactionType tipo, String descricao,
                       Disposal descarte, Challenge desafio, Instant momento) {
        if (quantidade <= 0) {
            throw new IllegalArgumentException("amount deve ser positivo");
        }
        // 1. Trava o usuário e soma ao saldo.
        User usuario = travarUsuario(idUsuario);
        usuario.earn(quantidade);
        // 2. Grava no fim da corrente HMAC do usuário (cada lançamento assina junto o hash do anterior).
        // anexar() faz flush: um 2º crédito na mesma transação (ex.: dois bônus de desafio) relê o saldo JÁ
        // atualizado no travarUsuario(); antes, o refresh descartava o crédito anterior ainda não gravado
        return extrato.anexar(idUsuario, tipo.name(), quantidade, usuario.getPoints(), descricao,
                descarte == null ? null : descarte.getId(), desafio == null ? null : desafio.getId(), null, momento);
    }

    /** Debita pontos de um resgate. Verifica o saldo com a linha travada (sem condição de corrida). */
    @Transactional(propagation = Propagation.MANDATORY)
    public UUID debitar(UUID idUsuario, int custo, String descricao, Redemption resgate, Instant momento) {
        // 1. Com a linha travada, confere o saldo; dois resgates ao mesmo tempo não passam juntos.
        User usuario = travarUsuario(idUsuario);
        if (usuario.getPoints() < custo) {
            throw new ExcecaoApi(CodigoErro.INSUFFICIENT_POINTS,
                    "Saldo insuficiente: você tem " + usuario.getPoints() + " pontos e a recompensa custa " + custo + ".");
        }
        usuario.spend(custo);
        // 2. O débito entra como lançamento negativo (REDEEM) na mesma corrente.
        return extrato.anexar(idUsuario, PointTransactionType.REDEEM.name(), -custo, usuario.getPoints(), descricao,
                null, null, resgate == null ? null : resgate.getId(), momento);
    }

    @Transactional(readOnly = true)
    public RespostaPaginada<PointTransactionDto> historico(UUID idUsuario, Integer pagina, Integer tamanho) {
        var paginacao = Paginacao.criar(pagina, tamanho, Sort.by(Sort.Direction.DESC, "createdAt").and(Sort.by(Sort.Direction.DESC, "balanceAfter")));
        return RespostaPaginada.of(transacoes.findByUserId(idUsuario, paginacao), PointTransactionDto::of);
    }
}
