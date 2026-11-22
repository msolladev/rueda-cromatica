# The image of the web (docs/08), the same for every environment: the built
# web and the API reference behind Nginx, which runs without root. The build
# contexts are what the CI built and tested, and ENVIRONMENT picks the file
# of environments/ with what changes per environment:
#   docker build --build-arg ENVIRONMENT=preprod \
#     --build-context site=apps/web/dist --build-context reference=dist/reference \
#     apps/web/deploy
FROM nginxinc/nginx-unprivileged:1.31.7-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e

ARG ENVIRONMENT
COPY environments/${ENVIRONMENT}.conf /etc/nginx/environment.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=site . /srv/site/
COPY --from=reference . /srv/site/reference/
