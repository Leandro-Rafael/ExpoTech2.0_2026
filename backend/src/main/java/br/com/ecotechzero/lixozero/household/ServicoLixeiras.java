package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.audit.AcaoAuditoria;
import br.com.ecotechzero.lixozero.audit.ServicoAuditoria;
import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.category.CodigoCategoria;
import br.com.ecotechzero.lixozero.category.DtosCategoria.CategoryRef;
import br.com.ecotechzero.lixozero.category.ServicoCategorias;
import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.collection.RepositorioSolicitacoesColeta;
import br.com.ecotechzero.lixozero.collection.StatusSolicitacaoColeta;
import br.com.ecotechzero.lixozero.collection.OrigemColeta;
import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.PontoGeografico;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.household.DtosResidencia.CreateBinRequest;
import br.com.ecotechzero.lixozero.household.DtosResidencia.ReadingPoint;
import br.com.ecotechzero.lixozero.household.DtosResidencia.SmartBinCreated;
import br.com.ecotechzero.lixozero.household.DtosResidencia.SmartBinDto;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.DtosUsuario.HouseholdRef;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Collections;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Lixeiras inteligentes: cadastro, leituras do sensor e abertura AUTOMÁTICA de solicitação de coleta
 * quando o nível atinge o limite configurado (no máximo uma solicitação aberta por lixeira).
 */
@Service
public class ServicoLixeiras {

    static final int MAXIMO_LIXEIRAS_POR_RESIDENCIA = 12;
    private static final SecureRandom ALEATORIO = new SecureRandom();

    /** Densidade aproximada (kg por litro) de cada material numa lixeira doméstica, para estimar o peso. */
    private static final Map<CodigoCategoria, Double> DENSIDADE_KG_POR_LITRO = Map.of(
            CodigoCategoria.PLASTICO, 0.04, CodigoCategoria.PAPEL, 0.08, CodigoCategoria.VIDRO, 0.30,
            CodigoCategoria.METAL, 0.06, CodigoCategoria.ORGANICO, 0.45, CodigoCategoria.ELETRONICO, 0.25,
            CodigoCategoria.REJEITO, 0.15);

    private final RepositorioLixeiras lixeiras;
    private final RepositorioResidencias residencias;
    private final RepositorioLeiturasLixeira leituras;
    private final RepositorioSolicitacoesColeta solicitacoes;
    private final RepositorioUsuarios usuarios;
    private final ServicoCategorias categorias;
    private final ServicoAuditoria auditoria;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ServicoLixeiras(RepositorioLixeiras lixeiras, RepositorioResidencias residencias, RepositorioLeiturasLixeira leituras, RepositorioSolicitacoesColeta solicitacoes,
                           RepositorioUsuarios usuarios, ServicoCategorias categorias, ServicoAuditoria auditoria, PropriedadesApp propriedades, Clock relogio) {
        this.lixeiras = lixeiras;
        this.residencias = residencias;
        this.leituras = leituras;
        this.solicitacoes = solicitacoes;
        this.usuarios = usuarios;
        this.categorias = categorias;
        this.auditoria = auditoria;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public List<SmartBinDto> listarMinhas(UsuarioAutenticado logado) {
        Household residencia = residenciaAtual(logado);
        if (residencia == null) {
            return List.of();
        }
        return lixeiras.findByHouseholdIdOrderByName(residencia.getId()).stream().map(b -> paraDto(b, false)).toList();
    }

    @Transactional(readOnly = true)
    public List<SmartBinDto> listarTodas() {
        return lixeiras.findAllByOrderByName().stream().map(b -> paraDto(b, true)).toList();
    }

    @Transactional
    public SmartBinCreated criar(UsuarioAutenticado logado, CreateBinRequest entrada) {
        Household residencia = residenciaAtual(logado);
        if (residencia == null) {
            throw ExcecaoApi.regraNegocio("Crie ou entre em uma residência antes de cadastrar lixeiras.");
        }
        residencias.findByIdForUpdate(residencia.getId()); // serializa cadastros simultâneos (limite por residência)
        if (lixeiras.countByHouseholdId(residencia.getId()) >= MAXIMO_LIXEIRAS_POR_RESIDENCIA) {
            throw ExcecaoApi.regraNegocio("Limite de " + MAXIMO_LIXEIRAS_POR_RESIDENCIA + " lixeiras por residência atingido.");
        }
        Category categoria = categorias.exigirAtiva(entrada.categoryId(), "categoryId");
        String nome = Textos.limpar(entrada.name());
        if (nome == null || nome.length() < 2) {
            throw ExcecaoApi.campo("name", "informe um nome para a lixeira");
        }
        String chaveDispositivo = novaChaveDispositivo();
        SmartBin lixeira = new SmartBin(residencia, categoria, nome, entrada.capacityLiters(), entrada.autoRequestThreshold(),
                UUID.randomUUID(), sha256(chaveDispositivo));
        lixeiras.save(lixeira);
        auditoria.registrar(AcaoAuditoria.SMART_BIN_CREATED, "SmartBin", lixeira.getId(), nome);
        // a chave do dispositivo é exibida somente agora; no banco fica apenas o hash
        return new SmartBinCreated(paraDto(lixeira, false), lixeira.getDeviceId(), chaveDispositivo);
    }

    @Transactional
    public void remover(UsuarioAutenticado logado, UUID lixeiraId) {
        Household residencia = residenciaAtual(logado);
        SmartBin lixeira = lixeiras.findById(lixeiraId)
                .filter(b -> residencia != null && b.getHousehold().getId().equals(residencia.getId()))
                .orElseThrow(() -> ExcecaoApi.naoEncontrado("Lixeira não encontrada."));
        lixeiras.delete(lixeira);
        auditoria.registrar(AcaoAuditoria.SMART_BIN_DELETED, "SmartBin", lixeiraId, lixeira.getName());
    }

    /**
     * Processa uma leitura do sensor (dispositivo real ou simulador). A lixeira é travada para que
     * leituras simultâneas não abram duas solicitações de coleta.
     */
    @Transactional
    public void registrarLeitura(UUID lixeiraId, int nivelEnchimento, int nivelBateria, Instant momento) {
        SmartBin lixeira = lixeiras.findByIdForUpdate(lixeiraId).orElseThrow(() -> ExcecaoApi.naoEncontrado("Lixeira não encontrada."));
        int enchimento = Math.clamp(nivelEnchimento, 0, 100);
        int bateria = Math.clamp(nivelBateria, 0, 100);
        lixeira.applyReading(enchimento, bateria, momento);
        leituras.save(new BinReading(lixeira, enchimento, bateria, momento));
        if (enchimento >= lixeira.getAutoRequestThreshold()
                && !solicitacoes.existsBySmartBinIdAndStatusIn(lixeira.getId(), StatusSolicitacaoColeta.OPEN)) {
            abrirSolicitacaoAutomatica(lixeira, enchimento);
        }
    }

    /** Após a coleta a lixeira volta a 0% (registramos uma leitura para o histórico). */
    @Transactional
    public void esvaziarAposColeta(UUID lixeiraId) {
        lixeiras.findByIdForUpdate(lixeiraId).ifPresent(lixeira -> {
            Instant agora = relogio.instant();
            lixeira.applyReading(0, lixeira.getBatteryLevel(), agora);
            leituras.save(new BinReading(lixeira, 0, lixeira.getBatteryLevel(), agora));
        });
    }

    private void abrirSolicitacaoAutomatica(SmartBin lixeira, int enchimento) {
        Household residencia = lixeira.getHousehold();
        PontoGeografico localizacao = LocalizacaoResidencia.of(residencia);
        CodigoCategoria codigo = lixeira.getCategory().getCode();
        double kg = Math.max(0.5, lixeira.getCapacityLiters() * (enchimento / 100.0) * DENSIDADE_KG_POR_LITRO.getOrDefault(codigo, 0.1));
        CollectionRequest solicitacao = new CollectionRequest(OrigemColeta.SMART_BIN, LocalizacaoResidencia.endereco(residencia),
                localizacao.latitude(), localizacao.longitude(), Set.of(codigo), Numeros.arredondar2(kg));
        solicitacao.setSmartBin(lixeira);
        solicitacao.setRequester(residencia.getOwner());
        solicitacao.setNotes("Solicitação automática: a lixeira \"" + lixeira.getName() + "\" atingiu " + enchimento + "%.");
        solicitacoes.save(solicitacao);
        auditoria.registrar(AcaoAuditoria.SMART_BIN_AUTO_REQUEST, "SmartBin", lixeira.getId(), "nível " + enchimento + "%");
    }

    public SmartBinDto paraDto(SmartBin b, boolean incluirResidencia) {
        List<ReadingPoint> historico = new ArrayList<>(leituras.findTop24ByBinIdOrderByRecordedAtDesc(b.getId()).stream()
                .map(r -> new ReadingPoint(r.getFillLevel(), r.getRecordedAt())).toList());
        Collections.reverse(historico); // antigas -> recentes
        return new SmartBinDto(b.getId(), b.getName(), CategoryRef.of(b.getCategory()), b.getCapacityLiters(),
                b.getFillLevel(), b.getBatteryLevel(), b.statusAt(relogio.instant(), offlineApos()),
                b.getAutoRequestThreshold(), b.getLastReadingAt(), historico,
                incluirResidencia ? HouseholdRef.of(b.getHousehold()) : null);
    }

    public Duration offlineApos() {
        return Duration.ofHours(propriedades.iot().offlineHours());
    }

    private Household residenciaAtual(UsuarioAutenticado logado) {
        User usuario = usuarios.findById(logado.id()).orElseThrow(() -> ExcecaoApi.naoEncontrado("Usuário não encontrado."));
        return usuario.getHousehold();
    }

    static String novaChaveDispositivo() {
        byte[] bytes = new byte[32];
        ALEATORIO.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String sha256(String valor) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(valor.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
