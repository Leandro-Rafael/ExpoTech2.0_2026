package br.com.ecotechzero.lixozero.user;

import br.com.ecotechzero.lixozero.auth.AuthDtos;
import br.com.ecotechzero.lixozero.auth.AuthService;
import br.com.ecotechzero.lixozero.organization.OrganizationDto;
import br.com.ecotechzero.lixozero.organization.OrganizationRepository;
import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.UserDtos.UserMe;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Perfil do usuário logado e lista pública de organizações. */
@RestController
public class ProfileController {

    private final UserService userService;
    private final AuthService authService;
    private final OrganizationRepository organizations;

    public ProfileController(UserService userService, AuthService authService, OrganizationRepository organizations) {
        this.userService = userService;
        this.authService = authService;
        this.organizations = organizations;
    }

    @PatchMapping("/api/me")
    public UserMe update(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody UserDtos.UpdateProfileRequest body) {
        return userService.updateProfile(me.id(), body);
    }

    @PostMapping("/api/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@AuthenticationPrincipal AuthUser me, @Valid @RequestBody AuthDtos.ChangePasswordRequest body,
                               HttpServletRequest request, HttpServletResponse response) {
        authService.changePassword(me.id(), body, request, response);
    }

    @GetMapping("/api/organizations")
    @Transactional(readOnly = true)
    public List<OrganizationDto> organizations() {
        return organizations.findAllByOrderByName().stream().map(OrganizationDto::of).toList();
    }
}
