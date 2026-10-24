package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.common.ApiException;
import br.com.ecotechzero.lixozero.common.Numbers;
import br.com.ecotechzero.lixozero.common.Text;
import br.com.ecotechzero.lixozero.common.TokenBucketRateLimiter;
import br.com.ecotechzero.lixozero.config.AppProperties;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.CreateHouseholdRequest;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.HouseholdDto;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.HouseholdMember;
import br.com.ecotechzero.lixozero.household.HouseholdDtos.HouseholdStats;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.UserRepository;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Residência (Smart Home): criar, entrar por código de convite, sair, membros e estatísticas. */
@Service
public class HouseholdService {

    static final int MAX_MEMBERS = 12;
    private static final String INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I
    private static final SecureRandom RANDOM = new SecureRandom();

    private final HouseholdRepository households;
    private final UserRepository users;
    private final NamedParameterJdbcTemplate jdbc;
    private final TokenBucketRateLimiter limiter;
    private final AppProperties props;
    private final Clock clock;

    public HouseholdService(HouseholdRepository households, UserRepository users, NamedParameterJdbcTemplate jdbc,
                            TokenBucketRateLimiter limiter, AppProperties props, Clock clock) {
        this.households = households;
        this.users = users;
        this.jdbc = jdbc;
        this.limiter = limiter;
        this.props = props;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public Optional<HouseholdDto> getMine(AuthUser me) {
        return Optional.ofNullable(requireUser(me).getHousehold()).map(this::toDto);
    }

    @Transactional
    public HouseholdDto create(AuthUser me, CreateHouseholdRequest input) {
        User user = requireUser(me);
        if (user.getHousehold() != null) {
            throw ApiException.conflict("Você já faz parte de uma residência. Saia dela antes de criar outra.");
        }
        if ((input.latitude() == null) != (input.longitude() == null)) {
            throw ApiException.field("latitude", "informe latitude e longitude juntas");
        }
        Household household = new Household(required(input.name(), "name"), required(input.neighborhood(), "neighborhood"),
                required(input.city(), "city"), newInviteCode());
        household.setLocation(Text.truncate(Text.clean(input.address()), 200), input.latitude(), input.longitude());
        household.setOwner(user);
        households.save(household);
        user.setHousehold(household);
        return toDto(household);
    }

    @Transactional
    public HouseholdDto join(AuthUser me, String inviteCode) {
        limiter.check(TokenBucketRateLimiter.Policy.HOUSEHOLD_JOIN_USER, me.id().toString());
        User user = requireUser(me);
        Household household = households.findByInviteCode(inviteCode.strip().toUpperCase())
                .orElseThrow(() -> ApiException.field("inviteCode", "código de convite não encontrado"));
        if (user.getHousehold() != null) {
            if (user.getHousehold().getId().equals(household.getId())) {
                return toDto(household);
            }
            throw ApiException.conflict("Você já faz parte de outra residência. Saia dela antes de entrar nesta.");
        }
        if (users.countByHouseholdId(household.getId()) >= MAX_MEMBERS) {
            throw ApiException.business("Esta residência já atingiu o limite de " + MAX_MEMBERS + " moradores.");
        }
        if (household.getOwner() == null) {
            household.setOwner(user);
        }
        user.setHousehold(household);
        return toDto(household);
    }

    /** Sai da residência; se era o responsável, a posse passa ao morador mais antigo. */
    @Transactional
    public void leave(AuthUser me) {
        User user = requireUser(me);
        Household household = user.getHousehold();
        if (household == null) {
            return;
        }
        user.setHousehold(null);
        users.flush();
        if (household.getOwner() != null && household.getOwner().getId().equals(user.getId())) {
            household.setOwner(users.findByHouseholdIdOrderByCreatedAt(household.getId()).stream().findFirst().orElse(null));
        }
    }

    private HouseholdDto toDto(Household h) {
        List<User> members = users.findByHouseholdIdOrderByCreatedAt(h.getId());
        UUID ownerId = h.getOwner() == null ? null : h.getOwner().getId();
        List<HouseholdMember> memberDtos = members.stream()
                .map(u -> new HouseholdMember(u.getId(), u.getName(), u.getPoints(), u.getId().equals(ownerId)))
                .toList();
        return new HouseholdDto(h.getId(), h.getName(), h.getNeighborhood(), h.getCity(), h.getInviteCode(), memberDtos, stats(h.getId()));
    }

    /** Totais dos moradores atuais: kg aprovados (total e no mês), pontos acumulados e CO2 evitado. */
    private HouseholdStats stats(UUID householdId) {
        LocalDate monthStart = LocalDate.now(clock.withZone(props.zoneId())).withDayOfMonth(1);
        var params = new MapSqlParameterSource()
                .addValue("hid", householdId)
                .addValue("monthStart", Timestamp.from(monthStart.atStartOfDay(props.zoneId()).toInstant()));
        Map<String, Object> row = jdbc.queryForMap("""
                select coalesce(sum(d.quantity_kg), 0) as total_kg,
                       coalesce(sum(d.quantity_kg) filter (where d.disposed_at >= :monthStart), 0) as month_kg,
                       coalesce(sum(d.quantity_kg * c.co2_factor_kg), 0) as co2
                from disposals d
                join users u on u.id = d.user_id
                join categories c on c.id = d.category_id
                where u.household_id = :hid and d.status = 'APPROVED'
                """, params);
        Long points = jdbc.queryForObject("select coalesce(sum(total_earned), 0) from users where household_id = :hid", params, Long.class);
        return new HouseholdStats(Numbers.round2(Numbers.toDouble(row.get("total_kg"))), Numbers.round2(Numbers.toDouble(row.get("month_kg"))),
                points == null ? 0 : points, Numbers.round2(Numbers.toDouble(row.get("co2"))));
    }

    private User requireUser(AuthUser me) {
        return users.findById(me.id()).orElseThrow(() -> ApiException.notFound("Usuário não encontrado."));
    }

    private static String required(String value, String field) {
        String cleaned = Text.clean(value);
        if (cleaned == null || cleaned.length() < 2) {
            throw ApiException.field(field, "campo obrigatório");
        }
        return cleaned;
    }

    String newInviteCode() {
        for (int attempt = 0; attempt < 10; attempt++) {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) {
                sb.append(INVITE_ALPHABET.charAt(RANDOM.nextInt(INVITE_ALPHABET.length())));
            }
            if (!households.existsByInviteCode(sb.toString())) {
                return sb.toString();
            }
        }
        throw new IllegalStateException("Não foi possível gerar um código de convite único");
    }
}
