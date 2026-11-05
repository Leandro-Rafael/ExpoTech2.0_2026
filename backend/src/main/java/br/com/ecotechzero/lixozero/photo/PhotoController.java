package br.com.ecotechzero.lixozero.photo;

import br.com.ecotechzero.lixozero.security.AuthUser;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.util.UUID;

/** Envio de fotos dos descartes e exibição (só para quem tem permissão de ver). */
@RestController
public class PhotoController {

    private final PhotoService service;

    public PhotoController(PhotoService service) {
        this.service = service;
    }

    @PostMapping(value = "/api/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PhotoService.PhotoUpload upload(@AuthenticationPrincipal AuthUser me, @RequestParam("file") MultipartFile file) {
        return service.upload(me, file);
    }

    @GetMapping("/api/photos/{id}")
    public ResponseEntity<byte[]> get(@AuthenticationPrincipal AuthUser me, @PathVariable UUID id) {
        Photo photo = service.getForViewer(me, id);
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_JPEG)
                .cacheControl(CacheControl.maxAge(Duration.ofDays(1)).cachePrivate())
                .header("Content-Disposition", "inline")
                .body(photo.getData());
    }
}
