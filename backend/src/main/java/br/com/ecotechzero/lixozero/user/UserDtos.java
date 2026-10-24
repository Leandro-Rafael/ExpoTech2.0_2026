package br.com.ecotechzero.lixozero.user;

import br.com.ecotechzero.lixozero.gamification.LevelCatalog;
import br.com.ecotechzero.lixozero.household.Household;
import br.com.ecotechzero.lixozero.organization.OrganizationDto;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

/** DTOs de usuário expostos pela API (nunca expõem a entidade, o hash de senha etc.). */
public final class UserDtos {

    private UserDtos() {
    }

    public record HouseholdRef(UUID id, String name, String neighborhood) {
        public static HouseholdRef of(Household h) {
            return h == null ? null : new HouseholdRef(h.getId(), h.getName(), h.getNeighborhood());
        }
    }

    /** Usuário logado (contrato UserMe). securityWarnings = avisos de inspeção vigentes (0..3). */
    public record UserMe(UUID id, String name, String email, Role role, long points, long totalEarned,
                         LevelCatalog.LevelDto level, HouseholdRef household, OrganizationDto organization,
                         Instant createdAt, int securityWarnings) {
        public static UserMe of(User u) {
            return new UserMe(u.getId(), u.getName(), u.getEmail(), u.getRole(), u.getPoints(), u.getTotalEarned(),
                    LevelCatalog.levelFor(u.getTotalEarned()), HouseholdRef.of(u.getHousehold()),
                    OrganizationDto.of(u.getOrganization()), u.getCreatedAt(), u.activeSecurityWarnings(Instant.now()));
        }
    }

    /** Referência curta a um usuário (e-mail só aparece em visões administrativas). */
    public record UserRef(UUID id, String name, @JsonInclude(JsonInclude.Include.NON_NULL) String email) {
        public static UserRef of(User u) {
            return u == null ? null : new UserRef(u.getId(), u.getName(), null);
        }

        public static UserRef withEmail(User u) {
            return u == null ? null : new UserRef(u.getId(), u.getName(), u.getEmail());
        }
    }

    /**
     * PATCH /api/me. Classe com setters (em vez de record) para distinguir "campo ausente" (não altera)
     * de "organizationId: null" (remove a organização).
     */
    public static class UpdateProfileRequest {
        @Size(min = 2, max = 100)
        private String name;
        private UUID organizationId;
        private boolean organizationIdPresent;

        public String getName() { return name; }
        public void setName(String name) { this.name = name; }
        public UUID getOrganizationId() { return organizationId; }

        public void setOrganizationId(UUID organizationId) {
            this.organizationId = organizationId;
            this.organizationIdPresent = true;
        }

        @JsonIgnore
        public boolean isOrganizationIdPresent() { return organizationIdPresent; }
    }
}
