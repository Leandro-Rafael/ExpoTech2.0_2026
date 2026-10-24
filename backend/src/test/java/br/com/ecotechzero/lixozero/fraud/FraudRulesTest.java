package br.com.ecotechzero.lixozero.fraud;

import br.com.ecotechzero.lixozero.ai.AiSource;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.disposal.DisposalRepository;
import br.com.ecotechzero.lixozero.fraud.rules.AiMismatchRule;
import br.com.ecotechzero.lixozero.fraud.rules.DailyLimitRule;
import br.com.ecotechzero.lixozero.fraud.rules.MissingPhotoRule;
import br.com.ecotechzero.lixozero.fraud.rules.PhotoReuseRule;
import br.com.ecotechzero.lixozero.fraud.rules.QuantityOutlierRule;
import br.com.ecotechzero.lixozero.fraud.rules.SimilarPhotoRule;
import br.com.ecotechzero.lixozero.fraud.rules.VelocityRule;
import br.com.ecotechzero.lixozero.photo.PhotoHash;
import br.com.ecotechzero.lixozero.photo.PhotoMeta;
import br.com.ecotechzero.lixozero.photo.PhotoRepository;
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
    private static FraudContext ctx(double kg, PhotoMeta photo, CategoryCode ai, Double conf, AiSource source) {
        boolean server = source == AiSource.CLAUDE;
        return ctx2(kg, photo, server ? ai : null, server ? conf : null, server ? null : ai, server ? null : conf, server ? null : source);
    }

    private static FraudContext ctx2(double kg, PhotoMeta photo, CategoryCode serverAi, Double serverConf,
                                     CategoryCode clientAi, Double clientConf, AiSource clientSource) {
        return new FraudContext(USER, CategoryCode.ELETRONICO, 15, kg, photo, null, null, NOW, serverAi, serverConf,
                clientAi, clientConf, clientSource, NOW, ZoneId.of("America/Sao_Paulo"));
    }

    private static PhotoMeta photo(long dhash) {
        return new PhotoMeta(UUID.randomUUID(), USER, dhash, "abc", null, null, null, NOW);
    }

    @Test
    void quantityOutlierFlagsNearCategoryMax() {
        var rule = new QuantityOutlierRule();
        assertThat(rule.evaluate(ctx(14, null, null, null, null))).isPresent();
        assertThat(rule.evaluate(ctx(5, null, null, null, null))).isEmpty();
    }

    @Test
    void aiMismatchWeighsServerAiMoreThanLocal() {
        var rule = new AiMismatchRule();
        int server = rule.evaluate(ctx(1, null, CategoryCode.REJEITO, 0.9, AiSource.CLAUDE)).orElseThrow().score();
        int local = rule.evaluate(ctx(1, null, CategoryCode.REJEITO, 0.9, AiSource.LOCAL)).orElseThrow().score();
        assertThat(server).isGreaterThan(local);
        assertThat(rule.evaluate(ctx(1, null, CategoryCode.REJEITO, 0.4, AiSource.CLAUDE))).isEmpty(); // baixa confiança
        assertThat(rule.evaluate(ctx(1, null, CategoryCode.ELETRONICO, 0.95, AiSource.CLAUDE))).isEmpty(); // concorda
    }

    @Test
    void clientHintCanRaiseButNeverLowerRisk() {
        var rule = new AiMismatchRule();
        // servidor diverge; palpite forjado do cliente "concordando" não reduz o risco
        var forged = rule.evaluate(ctx2(1, null, CategoryCode.REJEITO, 0.9, CategoryCode.ELETRONICO, 0.99, AiSource.LOCAL));
        assertThat(forged).isPresent();
        assertThat(forged.get().score()).isEqualTo(30); // peso da IA do servidor
        // sem IA do servidor: palpite divergente do cliente aumenta o risco
        assertThat(rule.evaluate(ctx2(1, null, null, null, CategoryCode.REJEITO, 0.9, AiSource.LOCAL))).isPresent();
        // servidor confirmou a categoria: palpite local divergente é ignorado (sem falso positivo)
        assertThat(rule.evaluate(ctx2(1, null, CategoryCode.ELETRONICO, 0.9, CategoryCode.REJEITO, 0.9, AiSource.LOCAL))).isEmpty();
        // escolha manual não é IA
        assertThat(rule.evaluate(ctx2(1, null, null, null, CategoryCode.REJEITO, 0.9, AiSource.MANUAL))).isEmpty();
    }

    @Test
    void missingPhotoOnlyForHeavyDisposals() {
        var rule = new MissingPhotoRule();
        assertThat(rule.evaluate(ctx(6, null, null, null, null))).isPresent();
        assertThat(rule.evaluate(ctx(2, null, null, null, null))).isEmpty();
        assertThat(rule.evaluate(ctx(6, photo(1), null, null, null))).isEmpty();
    }

    @Test
    void dailyLimitSumsTheDayIncludingCurrentDisposal() {
        DisposalRepository repo = mock(DisposalRepository.class);
        when(repo.sumKgBetween(any(), any(), any(), any())).thenReturn(45.0);
        var rule = new DailyLimitRule(repo);
        assertThat(rule.evaluate(ctx(6, null, null, null, null))).isPresent();
        assertThat(rule.evaluate(ctx(4, null, null, null, null))).isEmpty();
    }

    @Test
    void velocityFlagsBursts() {
        DisposalRepository repo = mock(DisposalRepository.class);
        when(repo.countByUserIdAndCreatedAtAfter(any(), any())).thenReturn(4L);
        assertThat(new VelocityRule(repo).evaluate(ctx(1, null, null, null, null))).isPresent();
        when(repo.countByUserIdAndCreatedAtAfter(any(), any())).thenReturn(1L);
        assertThat(new VelocityRule(repo).evaluate(ctx(1, null, null, null, null))).isEmpty();
    }

    @Test
    void photoRulesDetectExactAndPerceptualDuplicates() {
        PhotoRepository photos = mock(PhotoRepository.class);
        when(photos.existsSameContent(anyString(), any())).thenReturn(true);
        assertThat(new PhotoReuseRule(photos).evaluate(ctx(1, photo(0L), null, null, null))).isPresent();

        long hash = 0b1011_0110L;
        long nearlyEqual = hash ^ 0b11L;      // 2 bits diferentes
        long different = ~hash;               // 64 bits diferentes
        when(photos.recentHashes(any(), any(), any())).thenReturn(List.of(new PhotoHash(UUID.randomUUID(), different, UUID.randomUUID())));
        assertThat(new SimilarPhotoRule(photos).evaluate(ctx(1, photo(hash), null, null, null))).isEmpty();
        when(photos.recentHashes(any(), any(), any())).thenReturn(List.of(new PhotoHash(UUID.randomUUID(), nearlyEqual, UUID.randomUUID())));
        Optional<FraudSignal> signal = new SimilarPhotoRule(photos).evaluate(ctx(1, photo(hash), null, null, null));
        assertThat(signal).isPresent();
        assertThat(signal.get().message()).contains("outro usuário");
    }

    @Test
    void engineSumsCapsAndFlagsAtThreshold() {
        AppProperties props = new AppProperties("./data", "America/Sao_Paulo", null, null, "", null, false, false, 50, null, null);
        FraudRule big = new FixedRule(60);
        FraudRule medium = new FixedRule(30);
        FraudRule broken = new FraudRule() {
            public String code() { return "QUEBRADA"; }
            public Optional<FraudSignal> evaluate(FraudContext c) { throw new IllegalStateException("falha"); }
        };
        var result = new FraudEngine(List.of(big, medium, broken), props).assess(ctx(1, null, null, null, null));
        assertThat(result.score()).isEqualTo(90);
        assertThat(result.flagged()).isTrue();
        assertThat(result.flags()).hasSize(2);

        var low = new FraudEngine(List.of(medium), props).assess(ctx(1, null, null, null, null));
        assertThat(low.flagged()).isFalse();
        var capped = new FraudEngine(List.of(big, big), props).assess(ctx(1, null, null, null, null));
        assertThat(capped.score()).isEqualTo(100);
    }

    private record FixedRule(int score) implements FraudRule {
        public String code() { return "FIXA_" + score; }
        public Optional<FraudSignal> evaluate(FraudContext c) { return Optional.of(new FraudSignal(code(), score, "regra " + score)); }
    }
}
