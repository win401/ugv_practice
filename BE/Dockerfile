# 1단계: Gradle로 실행 가능한 jar를 만든다.
FROM eclipse-temurin:17-jdk AS build
WORKDIR /app

# 빌드 설정을 먼저 복사해, 소스만 바뀌었을 때 의존성 다운로드 레이어를 재사용한다.
COPY gradlew settings.gradle build.gradle ./
COPY gradle gradle
RUN ./gradlew dependencies --no-daemon > /dev/null

COPY src src
RUN ./gradlew bootJar --no-daemon

# 2단계: JRE만 있는 작은 이미지에서 jar를 실행한다.
FROM eclipse-temurin:17-jre
WORKDIR /app

# root가 아닌 사용자로 실행한다.
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build /app/build/libs/*.jar app.jar
USER app

EXPOSE 8080
# 서버 시간대는 로컬·CI와 같은 한국 시간으로 고정한다.
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-Duser.timezone=Asia/Seoul", "-jar", "app.jar"]
