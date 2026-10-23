package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.user.Role;

import java.util.UUID;

/**
 * Usuário autenticado da requisição atual (principal do Spring Security).
 * Injetado nos controllers com {@code @AuthenticationPrincipal AuthUser me}.
 */
public record AuthUser(UUID id, String email, String name, Role role) {

    public boolean isAdmin() {
        return role == Role.ADMIN;
    }
}
