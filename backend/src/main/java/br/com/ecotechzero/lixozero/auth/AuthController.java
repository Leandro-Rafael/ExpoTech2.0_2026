package br.com.ecotechzero.lixozero.auth;

import br.com.ecotechzero.lixozero.security.AuthUser;
import br.com.ecotechzero.lixozero.user.UserDtos.UserMe;
import br.com.ecotechzero.lixozero.user.UserService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final UserService userService;

    public AuthController(AuthService authService, UserService userService) {
        this.authService = authService;
        this.userService = userService;
    }

    /** Garante o cookie XSRF-TOKEN (o front-end chama no boot da aplicação). */
    @GetMapping("/csrf")
    public ResponseEntity<Void> csrf(CsrfToken token) {
        token.getToken();
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserMe register(@Valid @RequestBody AuthDtos.RegisterRequest body, HttpServletRequest request, HttpServletResponse response) {
        return authService.register(body, request, response);
    }

    @PostMapping("/login")
    public UserMe login(@Valid @RequestBody AuthDtos.LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        return authService.login(body, request, response);
    }

    @PostMapping("/refresh")
    public UserMe refresh(HttpServletRequest request, HttpServletResponse response) {
        return authService.refresh(request, response);
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void logout(@AuthenticationPrincipal AuthUser me, HttpServletRequest request, HttpServletResponse response) {
        authService.logout(me == null ? null : me.id(), request, response);
    }

    @GetMapping("/me")
    public UserMe me(@AuthenticationPrincipal AuthUser me) {
        return userService.getMe(me.id());
    }
}
