package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.audit.AuditAction;
import br.com.ecotechzero.lixozero.audit.AuditService;
import br.com.ecotechzero.lixozero.category.Category;
import br.com.ecotechzero.lixozero.category.CategoryCode;
import br.com.ecotechzero.lixozero.category.CategoryDtos.CategoryRef;
import br.com.ecotechzero.lixozero.category.CategoryService;
import br.com.ecotechzero.lixozero.collection.CollectionRequest;
import br.com.ecotechzero.lixozero.collection.CollectionRequestRepository;
import br.com.ecotechzero.lixozero.collection.CollectionRequestStatus;
import br.com.ecotechzero.lixozero.collection.CollectionSource;
import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.GeoPoint;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.CreateBinRequest;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.ReadingPoint;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.SmartBinCreated;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.SmartBinDto;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserDtos.HouseholdRef;
import br.com.ecotechzero.lixozero.user.UserRepository;
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
public class SmartBinService {

    static final int MAX_BINS_PER_HOUSEHOLD = 12;
    private static final SecureRandom RANDOM = new SecureRandom();

    /** Densidade aproximada (kg por litro) de cada material numa lixeira doméstica, para estimar o peso. */
    private static final Map<CategoryCode, Double> DENSITY_KG_PER_LITER = Map.of(
            CategoryCode.PLASTICO, 0.04, CategoryCode.PAPEL, 0.08, CategoryCode.VIDRO, 0.30,
            CategoryCode.METAL, 0.06, CategoryCode.ORGANICO, 0.45, CategoryCode.ELETRONICO, 0.25,
            CategoryCode.REJEITO, 0.15);

    private final SmartBinRepository bins;
    private final BinReadingRepository readings;
    private final CollectionRequestRepository requests;
    private final UserRepository users;
    private final CategoryService categories;
    private final AuditService audit;
    private final AppProperties props;
    private final Clock clock;

    public SmartBinService(SmartBinRepository bins, BinReadingRepository readings, CollectionRequestRepository requests,
                           UserRepository users, CategoryService categories, AuditService audit, AppProperties props, Clock clock) {
        this.bins = bins;
        this.readings = readings;
        this.requests = requests;
        this.users = users;
        this.categories = categories;
        this.audit = audit;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<SmartBinDto> listMine(AuthUser me) {
        Household household = currentHousehold(me);
        if (household == null) {
            return List.of();
        }
        return bins.findByHouseholdIdOrderByName(household.getId()).stream().map(b -> toDto(b, false)).toList();
    }

    @Transactional(readOnly = true)
    public List<SmartBinDto> listAll() {
        return bins.findAllByOrderByName().stream().map(b -> toDto(b, true)).toList();
    }

    @Transactional
    public SmartBinCreated create(AuthUser me, CreateBinRequest input) {
        Household household = currentHousehold(me);
        if (household == null) {
            throw ApiException.business("Crie ou entre em uma residência antes de cadastrar lixeiras.");
        }
        if (bins.countByHouseholdId(household.getId()) >= MAX_BINS_PER_HOUSEHOLD) {
            throw ApiException.business("Limite de " + MAX_BINS_PER_HOUSEHOLD + " lixeiras por residência atingido.");
        }
        Category category = categories.requireActive(input.categoryId(), "categoryId");
        String name = Text.clean(input.name());
        if (name == null || name.length() < 2) {
            throw ApiException.field("name", "informe um nome para a lixeira");
        }
        String deviceKey = newDeviceKey();
        SmartBin bin = new SmartBin(household, category, name, input.capacityLiters(), input.autoRequestThreshold(),
                UUID.randomUUID(), sha256(deviceKey));
        bins.save(bin);
        audit.record(AuditAction.SMART_BIN_CREATED, "SmartBin", bin.getId(), name);
        // a chave do dispositivo é exibida somente agora; no banco fica apenas o hash
        return new SmartBinCreated(toDto(bin, false), bin.getDeviceId(), deviceKey);
    }

    @Transactional
    public void delete(AuthUser me, UUID binId) {
        Household household = currentHousehold(me);
        SmartBin bin = bins.findById(binId)
                .filter(b -> household != null && b.getHousehold().getId().equals(household.getId()))
                .orElseThrow(() -> ApiException.notFound("Lixeira não encontrada."));
        bins.delete(bin);
        audit.record(AuditAction.SMART_BIN_DELETED, "SmartBin", binId, bin.getName());
    }

    /**
     * Processa uma leitura do sensor (dispositivo real ou simulador). A lixeira é travada para que
     * leituras simultâneas não abram duas solicitações de coleta.
     */
    @Transactional
    public void recordReading(UUID binId, int fillLevel, int batteryLevel, Instant at) {
        SmartBin bin = bins.findByIdForUpdate(binId).orElseThrow(() -> ApiException.notFound("Lixeira não encontrada."));
        int fill = Math.clamp(fillLevel, 0, 100);
        int battery = Math.clamp(batteryLevel, 0, 100);
        bin.applyReading(fill, battery, at);
        readings.save(new BinReading(bin, fill, battery, at));
        if (fill >= bin.getAutoRequestThreshold()
                && !requests.existsBySmartBinIdAndStatusIn(bin.getId(), CollectionRequestStatus.OPEN)) {
            openAutomaticRequest(bin, fill);
        }
    }

    /** Após a coleta a lixeira volta a 0% (registramos uma leitura para o histórico). */
    @Transactional
    public void emptyAfterCollection(UUID binId) {
        bins.findByIdForUpdate(binId).ifPresent(bin -> {
            Instant now = clock.instant();
            bin.applyReading(0, bin.getBatteryLevel(), now);
            readings.save(new BinReading(bin, 0, bin.getBatteryLevel(), now));
        });
    }

    private void openAutomaticRequest(SmartBin bin, int fill) {
        Household household = bin.getHousehold();
        GeoPoint location = HouseholdLocation.of(household);
        CategoryCode code = bin.getCategory().getCode();
        double kg = Math.max(0.5, bin.getCapacityLiters() * (fill / 100.0) * DENSITY_KG_PER_LITER.getOrDefault(code, 0.1));
        CollectionRequest request = new CollectionRequest(CollectionSource.SMART_BIN, HouseholdLocation.address(household),
                location.latitude(), location.longitude(), Set.of(code), Numbers.round2(kg));
        request.setSmartBin(bin);
        request.setRequester(household.getOwner());
        request.setNotes("Solicitação automática: a lixeira \"" + bin.getName() + "\" atingiu " + fill + "%.");
        requests.save(request);
        audit.record(AuditAction.SMART_BIN_AUTO_REQUEST, "SmartBin", bin.getId(), "nível " + fill + "%");
    }

    public SmartBinDto toDto(SmartBin b, boolean includeHousehold) {
        List<ReadingPoint> history = new ArrayList<>(readings.findTop24ByBinIdOrderByRecordedAtDesc(b.getId()).stream()
                .map(r -> new ReadingPoint(r.getFillLevel(), r.getRecordedAt())).toList());
        Collections.reverse(history); // antigas -> recentes
        return new SmartBinDto(b.getId(), b.getName(), CategoryRef.of(b.getCategory()), b.getCapacityLiters(),
                b.getFillLevel(), b.getBatteryLevel(), b.statusAt(clock.instant(), offlineAfter()),
                b.getAutoRequestThreshold(), b.getLastReadingAt(), history,
                includeHousehold ? HouseholdRef.of(b.getHousehold()) : null);
    }

    public Duration offlineAfter() {
        return Duration.ofHours(props.iot().offlineHours());
    }

    private Household currentHousehold(AuthUser me) {
        User user = users.findById(me.id()).orElseThrow(() -> ApiException.notFound("Usuário não encontrado."));
        return user.getHousehold();
    }

    static String newDeviceKey() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    public static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
