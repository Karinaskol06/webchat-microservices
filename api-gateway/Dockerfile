# syntax=docker/dockerfile:1
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

COPY pom.xml .
COPY shared-module/pom.xml shared-module/
COPY discovery-service/pom.xml discovery-service/
COPY api-gateway/pom.xml api-gateway/
COPY auth-service/pom.xml auth-service/
COPY chat-service/pom.xml chat-service/
COPY notification-service/pom.xml notification-service/
COPY user-service/pom.xml user-service/

RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -pl shared-module,api-gateway -am dependency:go-offline -DskipTests \
    || mvn -B -pl shared-module,api-gateway -am dependency:resolve -DskipTests

COPY shared-module/src shared-module/src
COPY api-gateway/src api-gateway/src

RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -pl shared-module,api-gateway -am package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/api-gateway/target/*.jar app.jar
EXPOSE 8089
ENTRYPOINT ["java", "-jar", "app.jar"]
