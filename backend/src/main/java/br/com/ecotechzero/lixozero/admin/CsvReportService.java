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

    private static final int MAX_DIAS = 366;
    static final int MAX_ROWS = 50_000;
    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm");

    private final DisposalRepository descartes;
    private final AuditService auditoria;
    private final AppProperties propriedades;
    private final Clock relogio;

    public CsvReportService(DisposalRepository descartes, AuditService auditoria, AppProperties propriedades, Clock relogio) {
        this.descartes = descartes;
        this.auditoria = auditoria;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public String descartesCsv(LocalDate de, LocalDate ate) {
        ZoneId fuso = propriedades.zoneId();
        LocalDate fim = ate != null ? ate : LocalDate.now(relogio.withZone(fuso));
        LocalDate inicio = de != null ? de : fim.minusDays(30);
        if (inicio.isAfter(fim)) {
            throw ApiException.campo("from", "a data inicial deve ser anterior à final");
        }
        if (inicio.plusDays(MAX_DIAS).isBefore(fim)) {
            throw ApiException.campo("to", "o período máximo é de " + MAX_DIAS + " dias");
        }
        List<Disposal> linhas = descartes.findForReport(inicio.atStartOfDay(fuso).toInstant(), fim.plusDays(1).atStartOfDay(fuso).toInstant(),
                Limit.of(MAX_ROWS + 1));
        if (linhas.size() > MAX_ROWS) {
            // tamanho limitado: o relatório é montado em memória
            throw ApiException.regraNegocio("O período tem mais de " + MAX_ROWS + " descartes. Escolha um intervalo menor.");
        }
        StringBuilder csv = new StringBuilder("﻿");
        csv.append("id;data;usuario;email;categoria;kg;status;pontos;risco_fraude;sinalizado;revisado_em;motivo_recusa\n");
        for (Disposal d : linhas) {
            linha(csv,
                    d.getId().toString(),
                    DATA_HORA.format(d.getDisposedAt().atZone(fuso)),
                    d.getUser().getName(),
                    d.getUser().getEmail(),
                    d.getCategory().getName(),
                    String.format(Locale.forLanguageTag("pt-BR"), "%.3f", d.getQuantityKg()),
                    d.getStatus().name(),
                    String.valueOf(d.getPointsAwarded()),
                    String.valueOf(d.getFraudScore()),
                    d.isFlagged() ? "sim" : "nao",
                    d.getReviewedAt() == null ? "" : DATA_HORA.format(d.getReviewedAt().atZone(fuso)),
                    d.getRejectionReason());
        }
        auditoria.registrar(AuditAction.REPORT_EXPORTED, "Report", "disposals.csv", inicio + " a " + fim + " (" + linhas.size() + " linhas)");
        return csv.toString();
    }

    private static void linha(StringBuilder csv, String... celulas) {
        for (int i = 0; i < celulas.length; i++) {
            if (i > 0) csv.append(';');
            csv.append(escapar(celulas[i]));
        }
        csv.append('\n');
    }

    /** Neutraliza fórmulas e escapa aspas/separadores. */
    static String escapar(String valor) {
        if (valor == null || valor.isEmpty()) {
            return "";
        }
        String v = valor;
        // olha o primeiro caractere visível: " =1+1" também é interpretado como fórmula por algumas planilhas
        String visivel = v.stripLeading();
        char primeiro = visivel.isEmpty() ? v.charAt(0) : visivel.charAt(0);
        if (primeiro == '=' || primeiro == '+' || primeiro == '-' || primeiro == '@' || primeiro == '|'
                || v.charAt(0) == '\t' || v.charAt(0) == '\r') {
            v = "'" + v;
        }
        if (v.contains(";") || v.contains("\"") || v.contains("\n") || v.contains("\r")) {
            v = "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }
}
