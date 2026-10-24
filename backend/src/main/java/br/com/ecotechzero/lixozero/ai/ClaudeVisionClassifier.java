package br.com.ecotechzero.lixozero.ai;

import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.config.AppProperties;
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
public class ClaudeVisionClassifier implements WasteClassifier {

    private static final Logger log = LoggerFactory.getLogger(ClaudeVisionClassifier.class);

    private static final String SYSTEM_PROMPT = """
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

    private final AppProperties.Ai config;
    private final JsonMapper json;
    private final HttpClient http;

    public ClaudeVisionClassifier(AppProperties.Ai config, JsonMapper json) {
        this.config = config;
        this.json = json;
        this.http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
    }

    @Override
    public boolean isAvailable() {
        return true;
    }

    @Override
    public Optional<Classification> classify(byte[] jpeg) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create(config.baseUrl() + "/v1/messages"))
                    .timeout(config.timeout())
                    .header("content-type", "application/json")
                    .header("x-api-key", config.apiKey())
                    .header("anthropic-version", config.apiVersion())
                    .POST(HttpRequest.BodyPublishers.ofString(buildBody(jpeg), StandardCharsets.UTF_8))
                    .build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            if (response.statusCode() != 200) {
                log.warn("Classificação por IA falhou: HTTP {}", response.statusCode());
                return Optional.empty();
            }
            return parseResponse(response.body());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return Optional.empty();
        } catch (Exception e) {
            log.warn("Classificação por IA indisponível: {}", e.getClass().getSimpleName());
            return Optional.empty();
        }
    }

    String buildBody(byte[] jpeg) {
        ObjectNode body = json.createObjectNode();
        body.put("model", config.model());
        body.put("max_tokens", 2048);
        body.put("system", SYSTEM_PROMPT);

        ObjectNode outputConfig = body.putObject("output_config");
        outputConfig.put("effort", "low");
        ObjectNode format = outputConfig.putObject("format");
        format.put("type", "json_schema");
        ObjectNode schema = format.putObject("schema");
        schema.put("type", "object");
        ObjectNode properties = schema.putObject("properties");
        ObjectNode code = properties.putObject("categoryCode");
        code.put("type", "string");
        ArrayNode codes = code.putArray("enum");
        Arrays.stream(CategoryCode.values()).forEach(c -> codes.add(c.name()));
        properties.putObject("confidence").put("type", "number");
        properties.putObject("reasoning").put("type", "string");
        schema.putArray("required").add("categoryCode").add("confidence").add("reasoning");
        schema.put("additionalProperties", false);

        ObjectNode message = body.putArray("messages").addObject();
        message.put("role", "user");
        ArrayNode content = message.putArray("content");
        ObjectNode image = content.addObject();
        image.put("type", "image");
        ObjectNode source = image.putObject("source");
        source.put("type", "base64");
        source.put("media_type", "image/jpeg");
        source.put("data", Base64.getEncoder().encodeToString(jpeg));
        content.addObject().put("type", "text").put("text", "Classifique o resíduo principal desta foto.");
        return json.writeValueAsString(body);
    }

    /** Extrai o JSON da resposta de forma tolerante (ignora blocos de raciocínio e cercas de código). */
    Optional<Classification> parseResponse(String responseBody) {
        JsonNode root = json.readTree(responseBody);
        if ("refusal".equals(root.path("stop_reason").asString(""))) {
            return Optional.empty();
        }
        for (JsonNode block : root.path("content")) {
            if (!"text".equals(block.path("type").asString(""))) {
                continue;
            }
            String text = block.path("text").asString("");
            int start = text.indexOf('{');
            int end = text.lastIndexOf('}');
            if (start < 0 || end <= start) {
                continue;
            }
            JsonNode result = json.readTree(text.substring(start, end + 1));
            String codeText = result.path("categoryCode").asString("");
            CategoryCode code;
            try {
                code = CategoryCode.valueOf(codeText.strip().toUpperCase());
            } catch (IllegalArgumentException e) {
                return Optional.empty();
            }
            double confidence = result.path("confidence").asDouble(0.5);
            if (Double.isNaN(confidence)) {
                confidence = 0.5;
            }
            String reasoning = Text.truncate(Text.clean(result.path("reasoning").asString("")), 300);
            return Optional.of(new Classification(code, Math.clamp(confidence, 0.0, 1.0), reasoning, AiSource.CLAUDE,
                    Text.truncate(config.model(), 60)));
        }
        return Optional.empty();
    }
}
