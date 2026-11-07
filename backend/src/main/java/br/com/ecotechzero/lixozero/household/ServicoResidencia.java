package br.com.ecotechzero.lixozero.household;

import br.com.ecotechzero.lixozero.common.ExcecaoApi;
import br.com.ecotechzero.lixozero.common.Numeros;
import br.com.ecotechzero.lixozero.common.Textos;
import br.com.ecotechzero.lixozero.common.LimitadorDeTaxa;
import br.com.ecotechzero.lixozero.config.PropriedadesApp;
import br.com.ecotechzero.lixozero.household.DtosResidencia.CreateHouseholdRequest;
import br.com.ecotechzero.lixozero.household.DtosResidencia.HouseholdDto;
import br.com.ecotechzero.lixozero.household.DtosResidencia.HouseholdMember;
import br.com.ecotechzero.lixozero.household.DtosResidencia.HouseholdStats;
import br.com.ecotechzero.lixozero.security.UsuarioAutenticado;
import br.com.ecotechzero.lixozero.user.User;
import br.com.ecotechzero.lixozero.user.RepositorioUsuarios;
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
public class ServicoResidencia {

    static final int MAXIMO_MORADORES = 12;
    private static final String ALFABETO_CONVITE = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sem 0/O, 1/I
    private static final SecureRandom ALEATORIO = new SecureRandom();

    private final RepositorioResidencias residencias;
    private final RepositorioUsuarios usuarios;
    private final NamedParameterJdbcTemplate jdbc;
    private final LimitadorDeTaxa limitador;
    private final PropriedadesApp propriedades;
    private final Clock relogio;

    public ServicoResidencia(RepositorioResidencias residencias, RepositorioUsuarios usuarios, NamedParameterJdbcTemplate jdbc,
                            LimitadorDeTaxa limitador, PropriedadesApp propriedades, Clock relogio) {
        this.residencias = residencias;
        this.usuarios = usuarios;
        this.jdbc = jdbc;
        this.limitador = limitador;
        this.propriedades = propriedades;
        this.relogio = relogio;
    }

    @Transactional(readOnly = true)
    public Optional<HouseholdDto> buscarMinha(UsuarioAutenticado logado) {
        return Optional.ofNullable(exigirUsuario(logado).getHousehold()).map(this::paraDto);
    }

    @Transactional
    public HouseholdDto criar(UsuarioAutenticado logado, CreateHouseholdRequest entrada) {
        User usuario = exigirUsuario(logado);
        if (usuario.getHousehold() != null) {
            throw ExcecaoApi.conflito("Você já faz parte de uma residência. Saia dela antes de criar outra.");
        }
        if ((entrada.latitude() == null) != (entrada.longitude() == null)) {
            throw ExcecaoApi.campo("latitude", "informe latitude e longitude juntas");
        }
        Household residencia = new Household(obrigatorio(entrada.name(), "name"), obrigatorio(entrada.neighborhood(), "neighborhood"),
                obrigatorio(entrada.city(), "city"), novoCodigoConvite());
        residencia.setLocation(Textos.truncar(Textos.limpar(entrada.address()), 200), entrada.latitude(), entrada.longitude());
        residencia.setOwner(usuario);
        residencias.save(residencia);
        usuario.setHousehold(residencia);
        return paraDto(residencia);
    }

    @Transactional
    public HouseholdDto entrar(UsuarioAutenticado logado, String codigoConvite) {
        limitador.verificar(LimitadorDeTaxa.Policy.HOUSEHOLD_JOIN_USER, logado.id().toString());
        User usuario = exigirUsuario(logado);
        Household residencia = residencias.findByInviteCode(codigoConvite.strip().toUpperCase(Locale.ROOT))
                .flatMap(h -> residencias.findByIdForUpdate(h.getId()))
                .orElseThrow(() -> ExcecaoApi.campo("inviteCode", "código de convite não encontrado"));
        if (usuario.getHousehold() != null) {
            if (usuario.getHousehold().getId().equals(residencia.getId())) {
                return paraDto(residencia);
            }
            throw ExcecaoApi.conflito("Você já faz parte de outra residência. Saia dela antes de entrar nesta.");
        }
        if (usuarios.countByHouseholdId(residencia.getId()) >= MAXIMO_MORADORES) {
            throw ExcecaoApi.regraNegocio("Esta residência já atingiu o limite de " + MAXIMO_MORADORES + " moradores.");
        }
        if (residencia.getOwner() == null) {
            residencia.setOwner(usuario);
        }
        usuario.setHousehold(residencia);
        return paraDto(residencia);
    }

    /** Sai da residência; se era o responsável, a posse passa ao morador mais antigo. */
    @Transactional
    public void sair(UsuarioAutenticado logado) {
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
        return new HouseholdStats(Numeros.arredondar2(Numeros.paraDouble(linha.get("total_kg"))), Numeros.arredondar2(Numeros.paraDouble(linha.get("month_kg"))),
                pontos == null ? 0 : pontos, Numeros.arredondar2(Numeros.paraDouble(linha.get("co2"))));
    }

    private User exigirUsuario(UsuarioAutenticado logado) {
        return usuarios.findById(logado.id()).orElseThrow(() -> ExcecaoApi.naoEncontrado("Usuário não encontrado."));
    }

    private static String obrigatorio(String valor, String campo) {
        String limpo = Textos.limpar(valor);
        if (limpo == null || limpo.length() < 2) {
            throw ExcecaoApi.campo(campo, "campo obrigatório");
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
