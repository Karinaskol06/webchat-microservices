# syntax=docker/dockerfile:1
#build image with maven and JDK 21
FROM maven:3.9.6-eclipse-temurin-21 AS build
WORKDIR /app

#copies the parent POM and every module POMs (to have stubs for each module)
COPY pom.xml .
COPY shared-module/pom.xml shared-module/
COPY discovery-service/pom.xml discovery-service/
COPY api-gateway/pom.xml api-gateway/
COPY auth-service/pom.xml auth-service/
COPY chat-service/pom.xml chat-service/
COPY notification-service/pom.xml notification-service/
COPY user-service/pom.xml user-service/

#optimization for faster rebuilds
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -pl shared-module,chat-service -am dependency:go-offline -DskipTests \
    || mvn -B -pl shared-module,chat-service -am dependency:resolve -DskipTests

#copies the code needed for chat service (depends on shared module)
COPY shared-module/src shared-module/src
COPY chat-service/src chat-service/src

#builds a runnable JAR
RUN --mount=type=cache,target=/root/.m2 \
    mvn -B -pl shared-module,chat-service -am package -DskipTests

#slim runtime image
FROM eclipse-temurin:21-jre
WORKDIR /app
#copies the built artifact
COPY --from=build /app/chat-service/target/*.jar app.jar
EXPOSE 8083
#starts the app
ENTRYPOINT ["java", "-jar", "app.jar"]
