# ADR-0023: Documentación técnica

- **Estado:** aceptada
- **Fecha:** 2026-11-18

## Contexto

La referencia de la API de los paquetes está escrita a mano en castellano, en docs/05 §6.4-6.7 (`color-wheel`), docs/06 §6 (`matching`) y docs/01 §4 (los tipos del modelo). Además, el código ya tiene comentarios de documentación en inglés para parte de esa API. Cada cambio en la API hay que hacerlo en los dos sitios, y el editor solo muestra los comentarios del código.

El repositorio no tiene ningún README. La instalación y los comandos solo están en CLAUDE.md, que está escrito como instrucciones para Claude Code.

## Decisión

- **Referencia de la API generada con TypeDoc** desde los comentarios TSDoc, en inglés como el resto del código. Solo para `color-wheel` y `domain`, los paquetes que otros consumen como librería. `catalog-builder` es una herramienta de línea de comandos y se explica con su README.
- **Especificaciones sin firmas ni tipos.** docs/05, docs/06 y docs/01 describen el comportamiento, las reglas y el modelo en prosa, y enlazan a la referencia. Se quitan docs/05 §6.4-6.7, docs/06 §6 y docs/01 §4.
- **Generación local** con `pnpm docs`, en una carpeta ignorada por git. La CI comprueba que la generación termina sin avisos (por ejemplo, un enlace a algo que ya no existe), sin publicar nada. Al pasar a producción, la CI la publicará.
- **READMEs en castellano.**
  - El de la raíz explica qué es el proyecto, cómo se instala y los comandos.
  - CLAUDE.md sustituye su sección «Comandos» por una importación del README.
  - El de cada paquete explica qué hace, con un ejemplo mínimo y los enlaces a su especificación y a la referencia.
- **La API REST de la fase 6** se documentará desde su especificación OpenAPI, con Scalar como candidato. Se decide al elegir el framework de `apps/api`.

## Alternativas descartadas

- **La referencia escrita a mano en `docs/`**: está en castellano y no añade herramientas, pero se desincroniza del código, y el editor no la muestra.
- **Mantener a la vez la referencia en `docs/` y los comentarios del código**: duplica la información.
- **Mantener docs/01 §4 para el proyecto de claude.ai**: duplica el modelo. Si el proyecto necesita los tipos exactos, se le añade el fichero del esquema como fuente.
- **Versionar la web generada**: cada cambio de código traería un cambio en la web generada.
- **Publicarla ya en GitHub Pages**: supone un despliegue público que el ADR-0012 no contempla todavía, y hoy solo la usa Miguel.
- **Mantener los comandos en CLAUDE.md, con un README que solo enlaza**: quien llega desde GitHub tendría que leer instrucciones escritas para Claude Code.
- **Scalar para los paquetes**: documenta APIs HTTP a partir de OpenAPI, no librerías TypeScript.

## Consecuencias

- TypeDoc se añade como dependencia de desarrollo, con la versión fijada de forma exacta.
- La API pública de `color-wheel` y `domain` necesita comentarios TSDoc completos.
- La CI tiene un paso más.
- El proyecto de claude.ai tiene que cargar también el README para conocer los comandos.
