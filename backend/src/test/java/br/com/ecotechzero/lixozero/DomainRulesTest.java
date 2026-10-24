package br.com.ecotechzero.lixozero;

import br.com.ecotechzero.lixozero.admin.CsvReportServiceTestAccess;
import br.com.ecotechzero.lixozero.disposal.PointsCalculator;
import br.com.ecotechzero.lixozero.gamification.LevelCatalog;
import br.com.ecotechzero.lixozero.gamification.StreakCalculator;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.SimulationInput;
import br.com.ecotechzero.lixozero.impact.ImpactDtos.SimulationResult;
import br.com.ecotechzero.lixozero.impact.ScenarioSimulator;
import br.com.ecotechzero.lixozero.security.PasswordPolicy;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Regras de negócio puras: senhas, pontuação, níveis, sequência, simulador e CSV. */
class DomainRulesTest {

    private final PasswordPolicy policy = new PasswordPolicy();

    @Test
    void passwordPolicy() {
        String email = "maria.souza@exemplo.com.br";
        assertThat(policy.check("curta1", email)).isPresent();                       // menos de 10
        assertThat(policy.check("somenteletras", email)).isPresent();                // sem número
        assertThat(policy.check("1234567890123", email)).isPresent();                // sem letra
        assertThat(policy.check("MARIA.souza2050", email)).isPresent();              // contém o e-mail (parte local)
        assertThat(policy.check("Password123", email)).isPresent();                  // senha comum
        assertThat(policy.check("Senha@123456", email)).isPresent();                 // comum sem símbolos
        assertThat(policy.check("a".repeat(129) + "1", email)).isPresent();          // longa demais
        assertThat(policy.check("Ipê-amarelo-2050", email)).isEmpty();
        // senhas das contas de demonstração precisam passar na própria política
        assertThat(policy.check("EcoTech@2050", "admin@ecotechzero.com.br")).isEmpty();
        assertThat(policy.check("Coleta@2050", "coletor@ecotechzero.com.br")).isEmpty();
        assertThat(policy.check("Recicla@2050", "morador@ecotechzero.com.br")).isEmpty();
    }

    @Test
    void pointsAreRoundedWithMinimumAndAiBonus() {
        assertThat(PointsCalculator.points(10, 2.5, false)).isEqualTo(25);
        assertThat(PointsCalculator.points(10, 2.5, true)).isEqualTo(28);   // +10%
        assertThat(PointsCalculator.points(1, 0.2, false)).isEqualTo(1);    // mínimo de 1 ponto
    }

    @Test
    void levelsDependOnTotalEarned() {
        assertThat(LevelCatalog.levelFor(0).name()).isEqualTo("Semente");
        var muda = LevelCatalog.levelFor(1000);
        assertThat(muda.name()).isEqualTo("Muda");
        assertThat(muda.nextName()).isEqualTo("Árvore");
        assertThat(muda.progress()).isBetween(0.4, 0.5);
        var top = LevelCatalog.levelFor(1_000_000);
        assertThat(top.nextName()).isNull();
        assertThat(top.progress()).isEqualTo(1.0);
    }

    @Test
    void streakCountsConsecutiveDaysEndingTodayOrYesterday() {
        LocalDate today = LocalDate.of(2026, 10, 23);
        assertThat(StreakCalculator.streak(List.of(today, today.minusDays(1), today.minusDays(2), today.minusDays(4)), today)).isEqualTo(3);
        assertThat(StreakCalculator.streak(List.of(today.minusDays(1), today.minusDays(2)), today)).isEqualTo(2);
        assertThat(StreakCalculator.streak(List.of(today.minusDays(3)), today)).isZero();
    }

    @Test
    void simulationIsDeterministicAndConsistent() {
        var input = new SimulationInput(300_000, 1.1, 0.04, 0.5, 2035, 0.01);
        SimulationResult a = ScenarioSimulator.simulate(input, 2026);
        SimulationResult b = ScenarioSimulator.simulate(input, 2026);
        assertThat(a).isEqualTo(b);
        assertThat(a.years()).hasSize(2050 - 2026 + 1);
        assertThat(a.years().getFirst().recycledTonsScenario()).isEqualTo(a.years().getFirst().recycledTonsBaseline());
        var y2035 = a.years().stream().filter(y -> y.year() == 2035).findFirst().orElseThrow();
        assertThat(y2035.recyclingRate()).isEqualTo(0.5);
        assertThat(a.years().getLast().recyclingRate()).isEqualTo(0.5);   // mantém a meta depois do ano-alvo
        assertThat(a.totals().landfillAvoidedTons()).isPositive();
        assertThat(a.totals().co2AvoidedTons()).isPositive();

        var same = ScenarioSimulator.simulate(new SimulationInput(1000, 1.0, 0.3, 0.3, 2030, 0.0), 2026);
        assertThat(same.totals().landfillAvoidedTons()).isZero();        // sem mudança de taxa, sem ganho
    }

    @Test
    void csvCellsAreProtectedAgainstFormulaInjection() {
        assertThat(CsvReportServiceTestAccess.escape("=HYPERLINK(\"x\")")).startsWith("\"'=");
        assertThat(CsvReportServiceTestAccess.escape("+55 11")).isEqualTo("'+55 11");
        assertThat(CsvReportServiceTestAccess.escape("@SUM")).isEqualTo("'@SUM");
        assertThat(CsvReportServiceTestAccess.escape("a;b")).isEqualTo("\"a;b\"");
        assertThat(CsvReportServiceTestAccess.escape("Maria")).isEqualTo("Maria");
        assertThat(CsvReportServiceTestAccess.escape("  =1+1")).isEqualTo("'  =1+1");   // espaços antes da fórmula
        assertThat(CsvReportServiceTestAccess.escape("|cmd")).isEqualTo("'|cmd");
    }
}
