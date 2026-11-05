# Imagem do back-end para o Render (plano grátis, 512 MB de RAM).
FROM eclipse-temurin:25-jdk AS build
WORKDIR /app
COPY .mvn .mvn
COPY mvnw pom.xml ./
COPY src src
RUN chmod +x mvnw && ./mvnw -B -q -DskipTests package && cp target/lixozero-api-*.jar app.jar

FROM eclipse-temurin:25-jre
WORKDIR /app
RUN useradd --system --uid 10001 app && mkdir -p /tmp/lixozero && chown app /tmp/lixozero
COPY --from=build /app/app.jar app.jar
USER app
# Heap limitado para caber nos 512 MB; reinicia em vez de travar se a memória acabar.
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -Xss512k -XX:TieredStopAtLevel=1 -XX:+ExitOnOutOfMemoryError"
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
