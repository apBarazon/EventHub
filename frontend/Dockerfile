# stamp the build number into the page (visible proof of which version is live)
FROM alpine:3.20 AS build
ARG BUILD_NUMBER=dev
WORKDIR /site
COPY src/ ./
RUN sed -i "s/__BUILD__/${BUILD_NUMBER}/g" *.html

FROM nginxinc/nginx-unprivileged:1.27-alpine
COPY --from=build /site /usr/share/nginx/html
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://localhost:8080/ >/dev/null || exit 1
