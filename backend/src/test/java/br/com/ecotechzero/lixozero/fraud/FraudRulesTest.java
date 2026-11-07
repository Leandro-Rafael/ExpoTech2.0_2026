package br.com.ecotechzero.lixozero.fraud;

import br.com.ecotechzero.lixozero.ai.OrigemIa;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.disposal.RepositorioDescartes;
import br.com.ecotechzero.lixozero.fraud.rules.RegraDivergenciaIa;
import br.com.ecotechzero.lixozero.fraud.rules.RegraLimiteDiario;
import br.com.ecotechzero.lixozero.fraud.rules.RegraFotoAusente;
import br.com.ecotechzero.lixozero.fraud.rules.RegraFotoReutilizada;
import br.com.ecotechzero.lixozero.fraud.rules.RegraQuantidadeAtipica;
import br.com.ecotechzero.lixozero.fraud.rules.RegraFotoSemelhante;
import br.com.ecotechzero.lixozero.fraud.rules.RegraVelocidade;
import br.com.ecotechzero.lixozero.photo.PhotoHash;
import br.com.ecotechzero.lixozero.photo.PhotoMeta;
import br.com.ecotechzero.lixozero.photo.RepositorioFotos;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class FraudRulesTest {

    private static final UUID USER = UUID.randomUUID();
    private static final Instant NOW = Instant.parse("2026-10-23T15:00:00Z");

    /** source CLAUDE = classificação do servidor; demais = palpite do cliente. */
    private static ContextoFraude ctx(double kg, PhotoMeta photo, CodigoCategoria ai, Double conf, OrigemIa source) {
        boolean server = source == OrigemIa.CLAUDE;
        return ctx2(kg, photo, server ? ai : null, server ? conf : null, server ? null : ai, server ? null : conf, server ? null : source);
    }

    private static ContextoFraude ctx2(double kg, PhotoMeta photo, CodigoCategoria serverAi, Double serverConf,
                                     CodigoCategoria clientAi, Double clientConf, OrigemIa clientSource) {
        return new ContextoFraude(USER, CodigoCategoria.ELETRONICO, 15, kg, photo, null, null, NOW, serverAi, serverConf,
                clientAi, clientConf, clientSource, NOW, ZoneId.of("America/Sao_Paulo"));
    }

    private static PhotoMeta photo(long dhash) {
        return new PhotoMeta(UUID.randomUUID(), USER, dhash, "abc", null, null, null, NOW);
    }

    @Test
    void quantityOutlierFlagsNearCategoryMax() {
        var rule = new RegraQuantidadeAtipica();
        assertThat(rule.avaliar(ctx(14, null, null, null, null))).isPresent();
        assertThat(rule.avaliar(ctx(5, null, null, null, null))).isEmpty();
    }

    @Test
    void aiMismatchWeighsServerAiMoreThanLocal() {
        var rule = new RegraDivergenciaIa();
        int server = rule.avaliar(ctx(1, null, CodigoCategoria.REJEITO, 0.9, OrigemIa.CLAUDE)).orElseThrow().score();
        int local = rule.avaliar(ctx(1, null, CodigoCategoria.REJEITO, 0.9, OrigemIa.LOCAL)).orElseThrow().score();
        assertThat(server).isGreaterThan(local);
        assertThat(rule.avaliar(ctx(1, null, CodigoCategoria.REJEITO, 0.4, OrigemIa.CLAUDE))).isEmpty(); // baixa confiança
        assertThat(rule.avaliar(ctx(1, null, CodigoCategoria.ELETRONICO, 0.95, OrigemIa.CLAUDE))).isEmpty(); // concorda
    }

    @Test
    void clientHintCanRaiseButNeverLowerRisk() {
        var rule = new RegraDivergenciaIa();
        // servidor diverge; palpite forjado do cliente "concordando" não reduz o risco
        var forged = rule.avaliar(ctx2(1, null, CodigoCategoria.REJEITO, 0.9, CodigoCategoria.ELETRONICO, 0.99, OrigemIa.LOCAL));
        assertThat(forged).isPresent();
        assertThat(forged.get().score()).isEqualTo(30); // peso da IA do servidor
        // sem IA do servidor: palpite divergente do cliente aumenta o risco
        assertThat(rule.avaliar(ctx2(1, null, null, null, CodigoCategoria.REJEITO, 0.9, OrigemIa.LOCAL))).isPresent();
        // servidor confirmou a categoria: palpite local divergente é ignorado (sem falso positivo)
        assertThat(rule.avaliar(ctx2(1, null, CodigoCategoria.ELETRONICO, 0.9, CodigoCategoria.REJEITO, 0.9, OrigemIa.LOCAL))).isEmpty();
        // escolha manual não é IA
        assertThat(rule.avaliar(ctx2(1, null, null, null, CodigoCategoria.REJEITO, 0.9, OrigemIa.MANUAL))).isEmpty();
    }

    @Test
    void missingPhotoOnlyForHeavyDisposals() {
        var rule = new RegraFotoAusente();
        assertThat(rule.avaliar(ctx(6, null, null, null, null))).isPresent();
        assertThat(rule.avaliar(ctx(2, null, null, null, null))).isEmpty();
        assertThat(rule.avaliar(ctx(6, photo(1), null, null, null))).isEmpty();
    }

    @Test
    void dailyLimitSumsTheDayIncludingCurrentDisposal() {
        RepositorioDescartes repo = mock(RepositorioDescartes.class);
        when(repo.sumKgBetween(any(), any(), any(), any())).thenReturn(45.0);
        var rule = new RegraLimiteDiario(repo);
        assertThat(rule.avaliar(ctx(6, null, null, null, null))).isPresent();
        assertThat(rule.avaliar(ctx(4, null, null, null, null))).isEmpty();
    }

    @Test
    void velocityFlagsBursts() {
        RepositorioDescartes repo = mock(RepositorioDescartes.class);
        when(repo.countByUserIdAndCreatedAtAfter(any(), any())).thenReturn(4L);
        assertThat(new RegraVelocidade(repo).avaliar(ctx(1, null, null, null, null))).isPresent();
        when(repo.countByUserIdAndCreatedAtAfter(any(), any())).thenReturn(1L);
        assertThat(new RegraVelocidade(repo).avaliar(ctx(1, null, null, null, null))).isEmpty();
    }

    @Test
    void photoRulesDetectExactAndPerceptualDuplicates() {
        RepositorioFotos photos = mock(RepositorioFotos.class);
        when(photos.existsSameContent(anyString(), any())).thenReturn(true);
        assertThat(new RegraFotoReutilizada(photos).avaliar(ctx(1, photo(0L), null, null, null))).isPresent();

        long hash = 0b1011_0110L;
        long nearlyEqual = hash ^ 0b11L;      // 2 bits diferentes
        long different = ~hash;               // 64 bits diferentes
        when(photos.recentHashes(any(), any(), any())).thenReturn(List.of(new PhotoHash(UUID.randomUUID(), different, UUID.randomUUID())));
        assertThat(new RegraFotoSemelhante(photos).avaliar(ctx(1, photo(hash), null, null, null))).isEmpty();
        when(photos.recentHashes(any(), any(), any())).thenReturn(List.of(new PhotoHash(UUID.randomUUID(), nearlyEqual, UUID.randomUUID())));
        Optional<SinalFraude> signal = new RegraFotoSemelhante(photos).avaliar(ctx(1, photo(hash), null, null, null));
        assertThat(signal).isPresent();
        assertThat(signal.get().message()).contains("outro usuário");
    }

    @Test
    void engineSumsCapsAndFlagsAtThreshold() {
        PropriedadesApp props = new PropriedadesApp("./data", "America/Sao_Paulo", null, null, "", null, false, false, 50, null, null);
        RegraFraude big = new FixedRule(60);
        RegraFraude medium = new FixedRule(30);
        RegraFraude broken = new RegraFraude() {
            public String codigo() { return "QUEBRADA"; }
            public Optional<SinalFraude> avaliar(ContextoFraude c) { throw new IllegalStateException("falha"); }
        };
        var result = new MotorFraude(List.of(big, medium, broken), props).avaliar(ctx(1, null, null, null, null));
        assertThat(result.score()).isEqualTo(90);
        assertThat(result.flagged()).isTrue();
        assertThat(result.flags()).hasSize(2);

        var low = new MotorFraude(List.of(medium), props).avaliar(ctx(1, null, null, null, null));
        assertThat(low.flagged()).isFalse();
        var capped = new MotorFraude(List.of(big, big), props).avaliar(ctx(1, null, null, null, null));
        assertThat(capped.score()).isEqualTo(100);
    }

    private record FixedRule(int score) implements RegraFraude {
        public String codigo() { return "FIXA_" + score; }
        public Optional<SinalFraude> avaliar(ContextoFraude c) { return Optional.of(new SinalFraude(codigo(), score, "regra " + score)); }
    }
}
