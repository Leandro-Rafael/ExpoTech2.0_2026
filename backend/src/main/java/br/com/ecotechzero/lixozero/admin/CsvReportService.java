package br.com.ecotechzero.lixozero.admin;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.disposal.Disposal;
import br.com.ecotechzero.lixozero.disposal.DisposalRepository;
import org.springframework.data.domain.Limit;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * Relatório CSV de descartes (separador ";" e BOM UTF-8 para abrir corretamente no Excel em português).
 * Proteção contra CSV/Formula Injection: células que começam com = + - @ | (mesmo após espaços, ou tab/CR) recebem um apóstrofo
 * na frente, para que planilhas não as interpretem como fórmulas.
 */
@Service
public class CsvReportService {

    private static final int MAX_DAYS = 366;
    static final int MAX_ROWS = 50_000;
    private static final DateTimeFormatter DATE_TIME = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final DisposalRepository disposals;
    private final AuditService audit;
    private final AppProperties props;
    private final Clock clock;

    public CsvReportService(DisposalRepository disposals, AuditService audit, AppProperties props, Clock clock) {
        this.disposals = disposals;
        this.audit = audit;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public String disposalsCsv(LocalDate from, LocalDate to) {
        ZoneId zone = props.zoneId();
        LocalDate end = to != null ? to : LocalDate.now(clock.withZone(zone));
        LocalDate start = from != null ? from : end.minusDays(30);
        if (start.isAfter(end)) {
            throw ApiException.field("from", "a data inicial deve ser anterior à final");
        }
        if (start.plusDays(MAX_DAYS).isBefore(end)) {
            throw ApiException.field("to", "o período máximo é de " + MAX_DAYS + " dias");
        }
        List<Disposal> rows = disposals.findForReport(start.atStartOfDay(zone).toInstant(), end.plusDays(1).atStartOfDay(zone).toInstant(),
                Limit.of(MAX_ROWS + 1));
        if (rows.size() > MAX_ROWS) {
            // tamanho limitado: o relatório é montado em memória
            throw ApiException.business("O período tem mais de " + MAX_ROWS + " descartes. Escolha um intervalo menor.");
        }
        StringBuilder csv = new StringBuilder("﻿");
        csv.append("id;data;usuario;email;categoria;kg;status;pontos;risco_fraude;sinalizado;revisado_em;motivo_recusa\n");
        for (Disposal d : rows) {
            line(csv,
                    d.getId().toString(),
                    DATE_TIME.format(d.getDisposedAt().atZone(zone)),
                    d.getUser().getName(),
                    d.getUser().getEmail(),
                    d.getCategory().getName(),
                    String.format(Locale.forLanguageTag("pt-BR"), "%.3f", d.getQuantityKg()),
                    d.getStatus().name(),
                    String.valueOf(d.getPointsAwarded()),
                    String.valueOf(d.getFraudScore()),
                    d.isFlagged() ? "sim" : "nao",
                    d.getReviewedAt() == null ? "" : DATE_TIME.format(d.getReviewedAt().atZone(zone)),
                    d.getRejectionReason());
        }
        audit.record(AuditAction.REPORT_EXPORTED, "Report", "disposals.csv", start + " a " + end + " (" + rows.size() + " linhas)");
        return csv.toString();
    }

    private static void line(StringBuilder csv, String... cells) {
        for (int i = 0; i < cells.length; i++) {
            if (i > 0) csv.append(';');
            csv.append(escape(cells[i]));
        }
        csv.append('\n');
    }

    /** Neutraliza fórmulas e escapa aspas/separadores. */
    static String escape(String value) {
        if (value == null || value.isEmpty()) {
            return "";
        }
        String v = value;
        // olha o primeiro caractere visível: " =1+1" também é interpretado como fórmula por algumas planilhas
        String visible = v.stripLeading();
        char first = visible.isEmpty() ? v.charAt(0) : visible.charAt(0);
        if (first == '=' || first == '+' || first == '-' || first == '@' || first == '|'
                || v.charAt(0) == '\t' || v.charAt(0) == '\r') {
            v = "'" + v;
        }
        if (v.contains(";") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            v = "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }
}
