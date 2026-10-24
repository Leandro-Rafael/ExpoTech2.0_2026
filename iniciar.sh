#!/usr/bin/env bash
# Lixo Zero 2050 - inicia o sistema completo com um comando (Linux/macOS/Git Bash).
#
#   ./iniciar.sh             1a vez: compila front-end + back-end e inicia. Depois: inicia direto.
#   ./iniciar.sh --rebuild   recompila tudo (use depois de mudar o código).
#
# Requisitos: JDK 25 (JAVA_HOME ou "java" no PATH) e, para compilar o front-end, Node.js 20+.
# Para parar: Ctrl+C (o banco embutido é desligado com segurança).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONT="$ROOT/frontend"
BACK="$ROOT/backend"
JAR="$BACK/target/lixozero-api-1.0.0.jar"
REBUILD=0
[[ "${1:-}" == "--rebuild" ]] && REBUILD=1

# ---- Java 25
if [[ -z "${JAVA_HOME:-}" || ! -x "$JAVA_HOME/bin/java" && ! -x "$JAVA_HOME/bin/java.exe" ]]; then
  for d in "$HOME"/.jdks/jdk-25*; do [[ -d "$d" ]] && JAVA_HOME="$d"; done
fi
if [[ -n "${JAVA_HOME:-}" ]]; then JAVA="$JAVA_HOME/bin/java"; else JAVA="$(command -v java || true)"; fi
if [[ -z "$JAVA" ]] || ! "$JAVA" -version 2>&1 | grep -q 'version "25'; then
  echo "[ERRO] É preciso o JDK 25 (defina JAVA_HOME)." >&2; exit 1
fi
[[ -n "${JAVA_HOME:-}" ]] && export JAVA_HOME
echo "[ok] Java: $("$JAVA" -version 2>&1 | head -1)"

# ---- front-end
if [[ $REBUILD == 1 || ! -f "$FRONT/dist/index.html" ]]; then
  command -v npm >/dev/null || { echo "[ERRO] Node.js/npm não encontrado (necessário para compilar o front-end)." >&2; exit 1; }
  (cd "$FRONT" && { [[ -d node_modules ]] || npm ci --no-audit --no-fund; } && npm run build)
  REBUILD=1
fi
echo "[ok] Front-end: $FRONT/dist"

# ---- back-end (jar com o SPA embutido)
if [[ $REBUILD == 1 || ! -f "$JAR" ]]; then
  rm -rf "$BACK/target/classes/static"
  (cd "$BACK" && ./mvnw -q -Pspa -DskipTests package)
fi
echo "[ok] Pacote: $JAR"

cat <<EOF

 Lixo Zero 2050 iniciando em http://localhost:8080
 (a primeira inicialização cria o banco e os dados de demonstração e pode levar alguns minutos)

 Contas de demonstração:
   Morador  morador@ecotechzero.com.br / Recicla@2050
   Admin    admin@ecotechzero.com.br   / EcoTech@2050
   Coletor  coletor@ecotechzero.com.br / Coleta@2050

 Para parar: Ctrl+C.

EOF
# Roda a partir de backend/ para os dados ficarem em backend/data (banco, chaves).
cd "$BACK"
exec "$JAVA" -Xmx768m -XX:TieredStopAtLevel=1 -Dfile.encoding=UTF-8 -jar "$JAR"
