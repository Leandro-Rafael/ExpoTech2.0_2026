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
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/** Residência (Smart Home): criar, entrar por código de convite, sair, membros e estatísticas. */
@Service
public class HouseholdService {

    static final int MAXIMO_MORADORES = 12;
    private static final String ALFABETO_CONVITE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final HouseholdRepository residencias;
    private final UserRepository usuarios;
    private final NamedParameterJdbcTemplate jdbc;
    private final TokenBucketRateLimiter limitador;
    private final AppProperties propriedades;
    private final Clock relogio;

    public HouseholdService(HouseholdRepository residencias, UserRepository usuarios, NamedParameterJdbcTemplate jdbc,
                            TokenBucketRateLimiter limitador, AppProperties propriedades, Clock relogio) {
        this.residencias = residencias;
        this.usuarios = usuarios;
        this.jdbc = jdbc;
        this.limitador = limitador;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public Optional<HouseholdDto> buscarMinha(AuthUser logado) {
        return Optional.ofNullable(exigirUsuario(logado).getHousehold()).map(this::paraDto);
    }

    @Transactional
    public HouseholdDto criar(AuthUser logado, CreateHouseholdRequest entrada) {
        User usuario = exigirUsuario(logado);
        if (usuario.getHousehold() != null) {
            throw ApiException.conflito("Você já faz parte de uma residência. Saia dela antes de criar outra.");
        }
        if ((entrada.latitude() == null) != (entrada.longitude() == null)) {
            throw ApiException.campo("latitude", "informe latitude e longitude juntas");
        }
        Household residencia = new Household(obrigatorio(entrada.name(), "name"), obrigatorio(entrada.neighborhood(), "neighborhood"),
                obrigatorio(entrada.city(), "city"), novoCodigoConvite());
        residencia.setLocation(Text.truncar(Text.limpar(entrada.address()), 200), entrada.latitude(), entrada.longitude());
        residencia.setOwner(usuario);
        residencias.save(residencia);
        usuario.setHousehold(residencia);
        return paraDto(residencia);
    }

    @Transactional
    public HouseholdDto entrar(AuthUser logado, String codigoConvite) {
        limitador.verificar(TokenBucketRateLimiter.Policy.HOUSEHOLD_JOIN_USER, logado.id().toString());
        User usuario = exigirUsuario(logado);
        Household residencia = residencias.findByInviteCode(codigoConvite.strip().toUpperCase(Locale.ROOT))
                .flatMap(h -> residencias.findByIdForUpdate(h.getId()))
                .orElseThrow(() -> ApiException.campo("inviteCode", "código de convite não encontrado"));
        if (usuario.getHousehold() != null) {
            if (usuario.getHousehold().getId().equals(residencia.getId())) {
                return paraDto(residencia);
            }
            throw ApiException.conflito("Você já faz parte de outra residência. Saia dela antes de entrar nesta.");
        }
        if (usuarios.countByHouseholdId(residencia.getId()) >= MAXIMO_MORADORES) {
            throw ApiException.regraNegocio("Esta residência já atingiu o limite de " + MAXIMO_MORADORES + " moradores.");
        }
        if (residencia.getOwner() == null) {
            residencia.setOwner(usuario);
        }
        usuario.setHousehold(residencia);
        return paraDto(residencia);
    }

    /** Sai da residência; se era o responsável, a posse passa ao morador mais antigo. */
    @Transactional
    public void sair(AuthUser logado) {
        User usuario = exigirUsuario(logado);
        Household residencia = usuario.getHousehold();
        if (residencia == null) {
            return;
        }
        usuario.setHousehold(null);
        usuarios.flush();
        if (residencia.getOwner() != null && residencia.getOwner().getId().equals(usuario.getId())) {
            residencia.setOwner(usuarios.findByHouseholdIdOrderByCreatedAt(residencia.getId()).stream().findFirst().orElse(null));
        }
    }

    private HouseholdDto paraDto(Household h) {
        List<User> moradores = usuarios.findByHouseholdIdOrderByCreatedAt(h.getId());
        UUID donoId = h.getOwner() == null ? null : h.getOwner().getId();
        List<HouseholdMember> moradoresDto = moradores.stream()
                .map(u -> new HouseholdMember(u.getId(), u.getName(), u.getPoints(), u.getId().equals(donoId)))
                .toList();
        return new HouseholdDto(h.getId(), h.getName(), h.getNeighborhood(), h.getCity(), h.getInviteCode(), moradoresDto, estatisticas(h.getId()));
    }

    /** Totais dos moradores atuais: kg aprovados (total e no mês), pontos acumulados e CO2 evitado. */
    private HouseholdStats estatisticas(UUID residenciaId) {
        LocalDate inicioMes = LocalDate.now(relogio.withZone(propriedades.zoneId())).withDayOfMonth(1);
        var parametros = new MapSqlParameterSource()
                .addValue("hid", residenciaId)
                .addValue("monthStart", Timestamp.from(inicioMes.atStartOfDay(propriedades.zoneId()).toInstant()));
        Map<String, Object> linha = jdbc.queryForMap("""
                select coalesce(sum(d.quantity_kg), 0) as total_kg,
                       coalesce(sum(d.quantity_kg) filter (where d.disposed_at >= :monthStart), 0) as month_kg,
                       coalesce(sum(d.quantity_kg * c.co2_factor_kg), 0) as co2
                from disposals d
                join users u on u.id = d.user_id
                join categories c on c.id = d.category_id
                where u.household_id = :hid and d.status = 'APPROVED'
                """, parametros);
        Long pontos = jdbc.queryForObject("select coalesce(sum(total_earned), 0) from users where household_id = :hid", parametros, Long.class);
        return new HouseholdStats(Numbers.arredondar2(Numbers.paraDouble(linha.get("total_kg"))), Numbers.arredondar2(Numbers.paraDouble(linha.get("month_kg"))),
                pontos == null ? 0 : pontos, Numbers.arredondar2(Numbers.paraDouble(linha.get("co2"))));
    }

    private User exigirUsuario(AuthUser logado) {
        return usuarios.findById(logado.id()).orElseThrow(() -> ApiException.naoEncontrado("Usuário não encontrado."));
    }

    private static String obrigatorio(String valor, String campo) {
        String limpo = Text.limpar(valor);
        if (limpo == null || limpo.length() < 2) {
            throw ApiException.campo(campo, "campo obrigatório");
        }
        return limpo;
    }

    String novoCodigoConvite() {
        for (int tentativa = 0; tentativa < 10; tentativa++) {
            StringBuilder sb = new StringBuilder(8);
            for (int i = 0; i < 8; i++) {
                sb.append(ALFABETO_CONVITE.charAt(ALEATORIO.nextInt(ALFABETO_CONVITE.length())));
            }
            if (!residencias.existsByInviteCode(sb.toString())) {
                return sb.toString();
            }
        }
        throw new IllegalStateException("Não foi possível gerar um código de convite único");
    }
}
