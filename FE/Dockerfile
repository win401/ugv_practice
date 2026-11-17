# syntax=docker/dockerfile:1

# 1단계: 의존성 설치. package/lock 변경이 없으면 배포 간 캐시를 재사용합니다.
FROM node:24-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

# 2단계: React 빌드. 배포에서는 이 단계만 강제로 다시 실행해 최신 지도 키를 반영합니다.
FROM deps AS build
COPY . .
# PR CI에서는 키 없이 빌드할 수 있습니다. 운영 배포는 workflow에서 키를 필수 확인합니다.
# BuildKit이 이 명령에만 환경변수를 제공합니다. Vite 결과 JS에는 웹 지도 키가 포함됩니다.
RUN --mount=type=secret,id=vworld_api_key,env=VITE_VWORLD_API_KEY \
    npm run build

# 3단계: 빌드 결과(dist)만 nginx로 서빙
# 1.27은 지원이 끝난 개발 버전이라 현재 안정 버전(1.30)을 쓴다.
FROM nginx:1.30-alpine
# templates/ 아래 파일은 시작할 때 환경변수(API_UPSTREAM)를 채워 conf.d/default.conf가 된다.
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
