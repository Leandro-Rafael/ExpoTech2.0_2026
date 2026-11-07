package br.com.ecotechzero.lixozero.security;

import br.com.ecotechzero.lixozero.user.PerfilUsuario;

import java.util.UUID;

/**
 * Usuário autenticado da requisição atual (principal do Spring Security).
 * Injetado nos controllers com {@code @AuthenticationPrincipal UsuarioAutenticado me}.
 */
public record UsuarioAutenticado(UUID id, String email, String name, PerfilUsuario role) {

    public boolean isAdmin() {
        return role == PerfilUsuario.ADMIN;
    }
}
