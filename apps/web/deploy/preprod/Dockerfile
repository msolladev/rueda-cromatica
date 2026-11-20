# The preproduction's image (docs/08): the built web behind Nginx, which runs
# without root. The `site` build context is the `dist` that the CI built
# and tested:
#   docker build --build-context site=apps/web/dist apps/web/deploy/preprod
FROM nginxinc/nginx-unprivileged:1.30.6-alpine@sha256:f5116ed4606f3eb015dd4a8e28cb9b351476dc0ad4bc6e9f93b19cec130cdf03

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=site . /srv/site/
