# ADR-0009: Toolchain con pnpm y versiones fijadas de forma exacta

- **Estado:** aceptada
- **Fecha:** 2026-11-07

## Contexto

El repositorio es un monorepo con varios paquetes. Todos los entornos (cualquier equipo de desarrollo, la CI y el despliegue) tienen que usar exactamente las mismas versiones de Node y del gestor de paquetes, y actualizarlas a la vez, de forma deliberada y sin sorpresas.

## Decisión

- **Gestor de paquetes**: pnpm con workspaces. Sin orquestador (Turborepo, Nx): `pnpm -r` y `--filter` bastan para tres paquetes.
- **Versión de pnpm**: exacta en `packageManager`.
- **Versión de Node**: exacta en `devEngines.runtime`. pnpm la descarga y registra su checksum en `pnpm-lock.yaml`, así que no hace falta nvm ni ningún otro gestor de versiones.
- **Línea inicial de Node**: la LTS vigente al montar el repositorio. El parche exacto se fija en ese momento.
- **Dependencias directas**: se guardan con versión exacta. El lockfile fija las transitivas, y la CI instala con `--frozen-lockfile`.
- **Actualizaciones**: solo mediante PR. Dependabot los propone (Node, pnpm, dependencias y acciones de GitHub), la CI los valida y, al fusionarlos, todos los entornos cambian a la vez.

## Alternativas descartadas

- **npm o yarn workspaces**: pnpm evita las dependencias fantasma gracias a su `node_modules` estricto y puede gestionar la versión de Node desde el propio `package.json`.
- **nvm o `.nvmrc`**: es una herramienta más que mantener, y la versión no queda verificada por checksum.
- **Volta o Corepack**: otra herramienta más; además, Corepack ya no viene incluido con Node.
- **Rangos de versión (`^26`, `lts/*`)**: cada entorno podría acabar con una versión distinta.
- **Turborepo o Nx**: YAGNI con el tamaño actual del repositorio.

## Consecuencias

- `package.json` es la única fuente de verdad del entorno.
- Actualizar Node o pnpm es un PR como cualquier otro, con su CI.
- La imagen Docker del futuro backend tendrá que usar la misma versión de Node.
