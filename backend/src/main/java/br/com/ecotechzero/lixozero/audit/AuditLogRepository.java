package br.com.ecotechzero.lixozero.audit;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.UUID;

/** Leitura da auditoria para o painel admin (a gravação passa pelo AuditChain). */
public interface AuditLogRepository extends JpaRepository<AuditLog, UUID> {

    List<AuditLog> findTop10ByOrderByCreatedAtDesc();

    /**
     * Busca paginada com filtros opcionais: {@code anyAction=true} ignora a lista de ações;
     * {@code q} é um padrão LIKE já escapado (minúsculas) comparado com autor, detalhes, entidade e IP.
     */
    @Query("""
            select a from AuditLog a
            where (:anyAction = true or a.action in :actions)
              and (:q is null
                   or lower(a.actorLabel) like :q escape '\\'
                   or lower(a.details) like :q escape '\\'
                   or lower(a.entity) like :q escape '\\'
                   or lower(a.ip) like :q escape '\\')
            """)
    Page<AuditLog> search(@Param("anyAction") boolean anyAction, @Param("actions") Collection<String> actions,
                          @Param("q") String likePattern, Pageable pageable);
}
