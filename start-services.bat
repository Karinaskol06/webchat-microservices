@echo off
echo Starting infrastructure services...
echo.

echo 1. Starting PostgreSQL (should already be running as service)
net start postgresql-x64-15 2>nul || echo PostgreSQL service already running or not found
echo.

echo 2. Starting Redis
net start redis 2>nul || echo Redis service already running or not found
echo.

echo 3. Starting Eureka (discovery-service)
cd discovery-service
start "Discovery Service" cmd /k "mvn spring-boot:run"
cd ..
echo.

timeout /t 10 /nobreak
echo.

echo 4. Starting user-service
cd user-service
start "User Service" cmd /k "mvn spring-boot:run"
cd ..
echo.

timeout /t 5 /nobreak
echo.

echo 5. Starting auth-service
cd auth-service
start "Auth Service" cmd /k "mvn spring-boot:run"
cd ..
echo.

echo 6. Starting API Gateway
cd api-gateway
start "API Gateway" cmd /k "mvn spring-boot:run"
cd ..
echo.

echo ============================================
echo All services are starting!
echo Check each console window for status.
echo ============================================
echo.
echo Services will be available at:
echo - Eureka Dashboard: http://localhost:8761
echo - User Service:     http://localhost:8081
echo - Auth Service:     http://localhost:8082
echo - API Gateway:      http://localhost:8080
echo.
echo Press any key to continue...
pause > nul