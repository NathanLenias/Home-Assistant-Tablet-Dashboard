# Static files behind a tiny nginx. Your real config.js is NOT baked into the
# image (it holds your HA token): mount it at runtime, see docker-compose.yml.
FROM nginx:alpine
COPY . /usr/share/nginx/html
