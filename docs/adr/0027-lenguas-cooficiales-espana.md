# ADR-0027: Las lenguas cooficiales de España

- **Estado:** aceptada
- **Fecha:** 2026-11-20

## Contexto

La rueda y la web estaban en 10 idiomas ([ADR-0020](0020-rueda-paquete-independiente.md), [ADR-0024](0024-web.md)). El castellano es uno de ellos, pero no el catalán, el euskera ni el gallego, que son cooficiales en España: quien tiene el navegador en uno de ellos y no tiene el castellano entre sus idiomas acaba en inglés.

## Decisión

- **Catalán (`ca`), euskera (`eu`) y gallego (`gl`)**, en la rueda y en la web, que siguen yendo siempre en el mismo idioma. Van justo después del castellano en `LOCALES`, y así salen en el selector.
- **La misma detección** (`resolveLocale`): por el idioma exacto y después por el idioma base, así que `ca-ES` y el valenciano (`ca-ES-valencia`) van al catalán, y `eu-ES` y `gl-ES`, a los suyos.
- **Las rutas** siguen la regla de siempre: el idioma delante (`/ca/`, `/eu/`, `/gl/`) y la página de créditos con su nombre en ese idioma (`/ca/credits/`, `/eu/kredituak/`, `/gl/creditos/`).
- **El nombre de la web** se traduce como en los demás idiomas: «Roda cromàtica», «Kolore-gurpila» y «Roda cromática».

## Alternativas descartadas

- **Solo en la web**, sin tocar la rueda: la rueda saldría en otro idioma que la página que la rodea.

## Consecuencias

- La web pasa a 13 idiomas y 27 páginas, con su `404.html` en cada uno.
- Los textos nuevos los escribió Claude, como los de los otros 8 idiomas que no son el castellano ni el inglés.
- La página de mantenimiento de la preproducción también los lleva, y su test lo comprueba.
