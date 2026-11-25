# The image of the API (docs/08), the same for every environment: the API
# packed by pack.sh, which the CI built and tested, on the official Node of
# `devEngines` (a test keeps them equal), without root. The build context
# `api` is the unpacked tar:
#   docker build --build-context api=<unpacked pack.sh tar> apps/api/deploy
# The same image applies the migrations and loads the catalog (deploy.sh).
FROM node:26.13.0-trixie-slim@sha256:5adad64f9a1fca2d51972caa65983634c8a774eb300d72b20f7f2a0f60368072

COPY --from=api . /app/
WORKDIR /app/apps/api
USER node
# It listens on every address of its container, only reachable from the
# web's Nginx (deploy/compose.yaml). Prisma's CLI neither checks for updates
# nor sends telemetry.
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3000 \
    CHECKPOINT_DISABLE=1 \
    PRISMA_HIDE_UPDATE_MESSAGE=1
EXPOSE 3000
CMD ["node", "dist/main.js"]
