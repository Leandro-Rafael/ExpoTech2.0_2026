package br.com.ecotechzero.lixozero.ai;

import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.Arrays;
import java.util.Base64;
import java.util.Optional;

/**
 * Classificador que usa a API de mensagens da Anthropic (Claude, com visão).
 * <p>
 * Envia a foto em base64 e pede uma resposta em JSON estrito (structured outputs com JSON Schema):
 * {@code {categoryCode, confidence, reasoning}}. Timeout curto (~10 s) e tratamento defensivo:
 * qualquer falha (rede, recusa, JSON inesperado) resulta em "sem sugestão", nunca em erro para o usuário.
 * A chave da API fica apenas no servidor e nunca é registrada em log.
 */
public class ClassificadorVisaoClaude implements ClassificadorResiduos {

    private static final Logger log = LoggerFactory.getLogger(ClassificadorVisaoClaude.class);

    private static final String PROMPT_SISTEMA = """
            Você é um especialista em coleta seletiva no Brasil. Analise a foto e identifique o resíduo principal.
            Categorias possíveis:
            PLASTICO (garrafas PET, potes, sacolas, embalagens plásticas),
            PAPEL (papel, papelão, jornal, caixas, embalagens longa vida),
            VIDRO (garrafas, potes e frascos de vidro),
            METAL (latas de alumínio ou aço, tampas metálicas, sucata pequena),
            ORGANICO (restos de alimentos, cascas, borra de café, folhas),
            ELETRONICO (celulares, cabos, carregadores, pilhas, baterias, eletroeletrônicos),
            REJEITO (itens não recicláveis ou contaminados: papel higiênico, fraldas, bitucas, embalagens sujas).
            Responda somente no formato JSON pedido. "confidence" é um número de 0 a 1.
            "reasoning" é uma frase curta em português do Brasil explicando a escolha e uma dica de descarte.
            Se a imagem não mostrar um resíduo, use REJEITO com confidence baixa.""";

    private final PropriedadesApp.Ai configuracao;
    private final JsonMapper json;
    private final HttpClient http;

    public ClassificadorVisaoClaude(PropriedadesApp.Ai configuracao, JsonMapper json) {
        this.configuracao = configuracao;
        this.json = json;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    @Override
    public boolean estaDisponivel() {
        return true;
    }

    @Override
    public Optional<Classification> classificar(byte[] jpeg) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(configuracao.baseUrl() + "/v1/messages"))
                    .timeout(configuracao.timeout())
                    .header("content-type", "application/json")
                    .header("x-api-key", configuracao.apiKey())
                    .header("anthropic-version", configuracao.apiVersion())
                    .POST(HttpRequest.BodyPublishers.ofString(montarCorpo(jpeg), StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                log.warn("Classificação por IA falhou: HTTP {}", response.statusCode());
                return Optional.empty();
            }
            return interpretarResposta(response.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Classificação por IA indisponível: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    String montarCorpo(byte[] jpeg) {
        ObjectNode corpo = json.createObjectNode();
        corpo.put("model", configuracao.model());
        corpo.put("max_tokens", 2048);
        corpo.put("system", PROMPT_SISTEMA);

        ObjectNode configSaida = corpo.putObject("output_config");
        configSaida.put("effort", "low");
        ObjectNode formato = configSaida.putObject("format");
        formato.put("type", "json_schema");
        ObjectNode esquema = formato.putObject("schema");
        esquema.put("type", "object");
        ObjectNode propriedades = esquema.putObject("properties");
        ObjectNode codigo = propriedades.putObject("categoryCode");
        codigo.put("type", "string");
        ArrayNode codigos = codigo.putArray("enum");
        Arrays.stream(CodigoCategoria.values()).forEach(c -> codigos.add(c.name()));
        propriedades.putObject("confidence").put("type", "number");
        propriedades.putObject("reasoning").put("type", "string");
        esquema.putArray("required").add("categoryCode").add("confidence").add("reasoning");
        esquema.put("additionalProperties", false);

        ObjectNode mensagem = corpo.putArray("messages").addObject();
        mensagem.put("role", "user");
        ArrayNode conteudo = mensagem.putArray("content");
        ObjectNode imagem = conteudo.addObject();
        imagem.put("type", "image");
        ObjectNode origem = imagem.putObject("source");
        origem.put("type", "base64");
        origem.put("media_type", "image/jpeg");
        origem.put("data", Base64.getEncoder().encodeToString(jpeg));
        conteudo.addObject().put("type", "text").put("text", "Classifique o resíduo principal desta foto.");
        return json.writeValueAsString(corpo);
    }

    /** Extrai o JSON da resposta de forma tolerante (ignora blocos de raciocínio e cercas de código). */
    Optional<Classification> interpretarResposta(String corpoResposta) {
        JsonNode raiz = json.readTree(corpoResposta);
        if ("refusal".equals(raiz.path("stop_reason").asString(""))) {
            return Optional.empty();
        }
        for (JsonNode bloco : raiz.path("content")) {
            if (!"text".equals(bloco.path("type").asString(""))) {
                continue;
            }
            String texto = bloco.path("text").asString("");
            int inicio = texto.indexOf('{');
            int fim = texto.lastIndexOf('}');
            if (inicio < 0 || fim <= inicio) {
                continue;
            }
            JsonNode resultado = json.readTree(texto.substring(inicio, fim + 1));
            String textoCodigo = resultado.path("categoryCode").asString("");
            CodigoCategoria codigo;
            try {
                codigo = CodigoCategoria.valueOf(textoCodigo.strip().toUpperCase());
            } catch (IllegalArgumentException e) {
                return Optional.empty();
            }
            double confianca = resultado.path("confidence").asDouble(0.5);
            if (Double.isNaN(confianca)) {
                confianca = 0.5;
            }
            String justificativa = Textos.truncar(Textos.limpar(resultado.path("reasoning").asString("")), 300);
            return Optional.of(new Classification(codigo, Math.clamp(confianca, 0.0, 1.0), justificativa, OrigemIa.CLAUDE,
                    Textos.truncar(configuracao.model(), 60)));
        }
        return Optional.empty();
    }
}
