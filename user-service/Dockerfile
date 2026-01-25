#FROM maven:3.9-eclipse-temurin-17 AS build
#WORKDIR /app
#COPY ../pom.xml ./pom.xml
#COPY pom.xml ./module-pom.xml
#RUN cat module-pom.xml > pom.xml
#RUN mvn dependency:go-offline -B
#COPY src ./src
#RUN mvn clean package -DskipTests

#FROM eclipse-temurin:17-jre-alpine
#WORKDIR /app
#RUN apk add --no-cache curl
#COPY --from=build /app/target/*.jar app.jar
#EXPOSE 8081
#RUN addgroup -S spring && adduser -S spring -G spring
#USER spring:spring
#ENTRYPOINT ["java", "-jar", "-Dspring.profiles.active=docker", "app.jar"]