package br.com.ecotechzero.lixozero.admin;

/** Expõe o método de escape (package-private) para os testes. */
public final class CsvReportServiceTestAccess {

    private CsvReportServiceTestAccess() {
    }

    public static String escape(String value) {
        return ServicoRelatorioCsv.escapar(value);
    }
}
