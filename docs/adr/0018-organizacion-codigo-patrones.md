# ADR-0018: Organización del código y patrones

- **Estado:** aceptada; corregida en parte por ADR-0024
- **Fecha:** 2026-11-08

## Contexto

La estructura del monorepo (`domain`, `catalog-builder` y `apps/web`) figura en CLAUDE.md, pero ningún ADR explica por qué se separa así ni cómo se organiza el código dentro de cada paquete. La etapa 1 de la fase 4 ya implementó el contrato del catálogo en `domain`, y la etapa 2 empieza el builder, con acceso a disco y a red.

## Decisión

### Paquetes y dirección de las dependencias

- **`domain`**: lógica pura. Se ejecuta en el navegador, en Node y, en la fase 5, en la API. No tiene acceso a disco, red, navegador ni React.
- **`catalog-builder`**: herramienta de desarrollo que solo se ejecuta en Node, en la máquina de desarrollo o en la CI. Nunca llega al usuario.
- **`apps/web`**: presentación. La lógica vive en `domain`.
- **Dirección única**: `catalog-builder` → `domain` ← `apps/web`. El builder y la web validan el catálogo con la misma función, `parseCatalog` ([ADR-0002](0002-validacion-catalogo-zod.md)).
- **Las fronteras las hacen cumplir las herramientas**, no la disciplina:
  - `domain` compila sin los tipos de Node (`"types": []`) y sin la librería DOM, así que no puede importar `node:fs` ni usar `document`.
  - pnpm no resuelve paquetes que no estén declarados como dependencia, así que la web no puede importar el builder.

### Núcleo funcional en `domain`

- **Datos y comportamiento separados**: las entidades son datos y las reglas son funciones ([01-modelo-dominio.md](../01-modelo-dominio.md) §1).
- **Analizar en la entrada** (_parse, don't validate_): los datos externos se validan una sola vez con Zod, y lo que sale ya tiene tipos fiables, como los _branded types_.
- **Errores esperables como valor** (`Result`). Las excepciones quedan para los bugs.
- **Agregados de solo lectura** con constructor protegido: `Catalog` solo se obtiene a través de `parseCatalog`, y sus índices son privados.
- Sin puertos ni inyección de dependencias: `domain` no llama a nada externo, así que no hay nada que intercambiar.

### Puertos y adaptadores en los bordes (arquitectura hexagonal)

En `catalog-builder` y `apps/web` se aplica la arquitectura hexagonal en los bordes, con este criterio:

- **Si la lógica puede recibir los datos ya leídos, los recibe como argumento.** No hace falta puerto. Ejemplo: el pipeline del builder recibe los datos curados en memoria, y la capa exterior es la que lee el disco.
- **Si la lógica necesita llamar a la infraestructura mientras se ejecuta, se define un puerto**: una interfaz que declara la propia lógica, con un adaptador real y otro para los tests. Ejemplos:
  - `archive-sources`, que consulta la Wayback Machine y descarga ficheros.
  - La carga del catálogo en la web: hoy el fichero incluido en la app y, en la fase 5, la instantánea de la API ([ADR-0017](0017-arquitectura-objetivo-backend.md)).
- Los puertos se introducen cuando aparece la necesidad, no por anticipado.

### Organización dentro de cada paquete

Se organiza por módulo funcional, no por tipo de fichero. Cada módulo agrupa lo que cambia junto.

```
packages/domain/src/
  catalog/     contrato del catálogo: esquema, validación, agregado y reglas
  color/       conversiones y ΔE (CIEDE2000)
  matching/    equivalencias calculadas
  harmony/     armonías de la rueda
  scheme/      esquema de miniatura: base, sombra, luz y acento
  index.ts     API pública del paquete

packages/catalog-builder/src/
  curated/     esquemas y lectura validada de data/ (docs/04 §2-5)
  pipeline/    pasos del proceso de docs/04 §6, como funciones puras
  importers/   fuente → filas, como funciones puras (la fase 5 los mueve a packages/importers)
  adapters/    implementación de los puertos con disco y red
  cli/         puntos de entrada (build y archive-sources): leen, ejecutan y escriben

apps/web/src/
  features/    una carpeta por funcionalidad: rueda, equivalencias, créditos…
  catalog/     carga del catálogo y pantalla de error bloqueante
```

- **Dependencias entre módulos de `domain`**: `color` no depende de nada; `harmony` depende de `color`; `scheme` depende de `color` y `harmony`; `matching` depende de `catalog` y `color`. No se admiten ciclos.
- **API pública**: lo que usan otros paquetes se exporta desde el `index.ts` del paquete. Lo interno, como `createCatalog`, no se exporta.
- **Tests**: junto al código que prueban (`*.test.ts`).
- Los módulos se crean cuando la hoja de ruta llega a ellos.

## Alternativas descartadas

- **Un único paquete**: la frontera entre el código del navegador y el que usa el disco dependería solo de la disciplina. Un `import` equivocado no se detectaría hasta que la web fallara en el navegador.
- **Organización por tipo de fichero** (`schemas/`, `services/`, `utils/`): separa lo que cambia junto. Tocar una funcionalidad obliga a editar varias carpetas.
- **Arquitectura hexagonal o _clean architecture_ también en `domain`**: serían puertos con una sola implementación posible, porque `domain` no tiene infraestructura que intercambiar. Su idea central (el dominio no depende de la infraestructura) ya la garantiza la separación en paquetes.
- **Clases con un contenedor de inyección de dependencias**: añade ceremonia y una dependencia sin resolver ningún problema que no resuelvan las funciones y los puertos explícitos.

## Consecuencias

- Las carpetas descritas aquí forman parte de la estructura prevista. Crearlas no requiere otra confirmación; una carpeta nueva fuera de esta lista, sí.
- `apps/web` declarará `@chromatic-wheel/domain` como dependencia en la etapa 5, cuando lo use.
- `apps/api`, `apps/admin` y `packages/importers` (fase 5) necesitarán su propia decisión de organización. La API tendrá infraestructura real (base de datos, autenticación), así que es previsible que use puertos de forma más amplia.
