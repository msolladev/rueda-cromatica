# ADR-0020: La rueda de color como paquete independiente

- **Estado:** propuesta
- **Fecha:** 2026-11-15

## Contexto

La rueda trabaja solo con colores: recibe uno y devuelve otros. No necesita saber nada de pinturas ni de marcas. La parte propia de Warhammer empieza después, al buscar la pintura más parecida a cada color que devuelve la rueda.

El [ADR-0018](0018-organizacion-codigo-patrones.md) colocaba la rueda dentro de `domain`, en los módulos `color`, `harmony` y `scheme`, junto al catálogo. Miguel propuso separarla como una librería que la web use y sobre la que enganche las pinturas.

Además, el [ADR-0019](0019-alcance-minimo-mvp.md) describía el esquema de miniatura como «base, sombra, luz y acento», y CLAUDE.md definía la sombra como una variación oscurecida de la base. Al concretar la etapa 4, Miguel corrigió las dos cosas a partir de su experiencia pintando.

## Decisión

### Paquete

- **`packages/color-wheel`** (`@rueda-cromatica/color-wheel`): TypeScript puro, sin React, sin navegador y sin depender de `domain`. Su única dependencia es culori.
- **No se publica en npm por ahora**, pero se diseña como si fuera a publicarse: API pública en `index.ts`, tests y ningún concepto de pinturas.
- **Solo la lógica.** El dibujo de la rueda con su plantilla giratoria se hace en `apps/web` en la etapa 5. Si después conviene reutilizarlo, se extrae a otro paquete.
- **Dependencias**: `apps/web` usa `color-wheel` y `domain`; `catalog-builder` usa `domain`. Entre `color-wheel` y `domain` no hay dependencia.
- **La búsqueda de la pintura más parecida (ΔE CIEDE2000) sigue en `domain`**, en el módulo `matching`, porque necesita el catálogo.

### Operación 1: armonía

- **Entrada**: un color, el modelo (RYB o digital) y el tipo de armonía.
- **Salida**: solo los colores de esa armonía.
- **Tipos**: complementario, complementario dividido, análogos, análogos con acento, tríada, tétrada rectangular, cuadrado y monocromático. Son las armonías habituales de una rueda de color, sin papeles añadidos.

Ejemplo: rojo, complementario. En RYB devuelve verde; en digital, cian.

### Operación 2: esquema de miniatura

- **Entrada**: el color base, el modelo y el tipo de luz (cálida o fría).
- **Salida**:
  - la base;
  - los otros dos colores de la tríada de la base;
  - el complementario de la base;
  - la sombra y la luz de la base.
- **Sombra**: la base mezclada con su complementario. Mezclar complementarios apaga el color y lo oscurece.
- **Luz**: la base mezclada con su color vecino en la rueda, aclarado:
  - cálida: el vecino en dirección al amarillo;
  - fría: el vecino en dirección al azul.
- **Casos límite**:
  - Si la base ya es amarilla y la luz es cálida, se mezcla con un amarillo más claro.
  - Si la base ya es azul y la luz es fría, se aclara con blanco.
- **Proporciones**: cuánto complementario lleva la sombra y cuánto vecino la luz son constantes con un valor de partida. Se ajustan al ver los resultados en la etapa 5. Ninguna fuente da cifras.

Ejemplo: verde en RYB con luz cálida. Tríada: naranja y violeta. Complementario: rojo. Sombra: verde con un poco de rojo, un verde oscuro y grisáceo. Luz: verde con un poco de verde-amarillo claro, un verde claro tirando a lima.

### Fuentes de la regla de sombra y luz

- El método del curso de pintura de Miguel: un verde se sombreó con rojo y se iluminó con un toque de amarillo lima.
- [Green Stuff World](https://www.greenstuffworld.com/en/module-blog?id=157): para oscurecer «in many cases it also works better to use a complementary color». El amarillo se ilumina con amarillos más claros o crema, sin perder saturación.
- [TourBox](https://www.tourboxtech.com/en/news/hue-shift-guide.html), sobre el _hue shift_: con una fuente de luz, las luces tienden a tonos más cálidos y las sombras a tonos más fríos.
- [Draw Paint Academy](https://drawpaintacademy.com/how-to-paint-under-different-light-sources/): lo cálido y lo frío son relativos, y el blanco enfría el color al aclararlo.

## Alternativas descartadas

- **La rueda dentro de `domain`**, como preveía el ADR-0018: la frontera entre la rueda y el catálogo dependería de la disciplina. Un paquete propio la hace obligatoria.
- **Publicarla ya en npm**: obliga a compilar, versionar cada cambio de la API, elegir licencia y mantener un proceso de publicación mientras el diseño todavía cambia. No aporta nada a la app.
- **Incluir el componente de React en el paquete**: ataría la lógica a React sin necesidad.
- **Devolver todas las armonías a la vez**: quien usa la rueda elige una plantilla, como en una rueda física, y solo necesita sus colores.
- **El esquema de miniatura como una armonía más**: responde a otra pregunta (cómo pintar una zona) y lleva sombra y luz, que no salen de girar la plantilla.
- **Sombra como la base oscurecida y luz como la base aclarada con colores fijos**: no es como se pinta. Las fuentes coinciden en que el tono se desplaza, no solo la luminosidad.

## Consecuencias

- Los módulos `color`, `harmony` y `scheme` que el ADR-0018 situaba en `domain` pasan a `color-wheel`. `domain` conserva `catalog` y `matching`. El resto del ADR-0018 sigue vigente.
- El esquema de miniatura del ADR-0019 («base, sombra, luz y acento») queda precisado por este ADR.
- La geometría de cada armonía y la conversión entre RYB y digital se especifican en la etapa 4, antes de implementarlas.
- Mostrar al usuario qué pinturas mezclar para conseguir la sombra o la luz es la funcionalidad de mezclas, que sigue en «Futuro». En el MVP se muestra el color resultante y la pintura más cercana.
- Publicar el paquete en npm requerirá un ADR nuevo.
