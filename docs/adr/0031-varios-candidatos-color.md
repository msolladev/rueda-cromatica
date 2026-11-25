# ADR-0031: Varios candidatos de color por pintura

- **Estado:** aceptada
- **Fecha:** 2026-11-22

## Contexto

El [ADR-0014](0014-origen-seleccion-color.md) fija la prioridad `measured` > `manufacturer` > `community`, el orden de las fuentes dentro de cada origen y una elección manual con nota. El [ADR-0019](0019-alcance-minimo-mvp.md) la aplazó y conservó su decisión 4: si una elección manual no se puede cumplir, el build falla y propone el siguiente candidato. Tras el [ADR-0030](0030-datos-curados-dos-capas.md), el builder fallaba con más de un candidato.

A 2026-11-22 casi no hay datos que lo usen:

- ninguna pintura tiene claves en dos fuentes;
- DonnervS solo tiene un `measuredHex`, el de AK11057 Vampiric Flesh: una muestra leída con dos aparatos que discrepan (#C2B193 y #A59784), descartada en una nota.

De las fuentes del [informe](../investigacion/2026-11-fuentes-datos.md), la tabla muestreada de SimoGecko da una segunda opinión sobre 128 Base y Layer no metálicas de Citadel, con el color promediado de fotos de muestras pintadas. Frente a la tabla oficial, el ΔE2000 tiene una mediana de 8,2, y 43 pinturas superan 10. El fichero de Warhammer Colour de DonnervS saca el color de la foto del bote, que en Contrast y Shade no sirve (Black Templar, `#989c9f`, a ΔE 38).

## Decisión

### Fuentes

- **La tabla muestreada de SimoGecko** entra como `simogecko-citadel-colours-sampled`, en `community`: es un color sacado de fotos, como define el ADR-0014. Va por delante de la tabla oficial, porque se acerca más a la pintura física. Cambia el color publicado de 127 pinturas. Su clave es el nombre, porque la tabla no tiene tipo ni repite nombres, y su importador no propone fichas: sus filas son claves de fichas existentes.
- **DonnervS entra en `measured`**, para que su medición sea candidata.
- El fichero de Warhammer Colour de DonnervS queda para cuando entre Tone Pro.

### Selección

- Los candidatos se ordenan por origen y, dentro de cada origen, por el orden de su lista en `color-policy.json`. Gana el primero que no esté descartado, salvo que haya una elección manual.
- **Un candidato se identifica por su fuente y su origen.** Una fila puede dar dos (su `hex` y su `measuredHex`), pero nunca dos del mismo origen.
- **La elección manual** (`colorChoice`) nombra el candidato, el hex que daba al elegirlo y una nota obligatoria. Si el candidato ya no existe o da otro hex, el build falla. El mensaje cita la ruta de la elección, el hex nuevo con la fila de su fuente y el candidato que se publicaría sin ella (decisión 4 del ADR-0019). También falla una elección que coincide con lo que ya elige la prioridad, como una exclusión obsoleta.
- **El descarte** (`rejectedColors`) es un mecanismo aparte: quita un candidato y deja que la prioridad elija entre los demás. Así, una fuente mejor que llegue después gana sin tocar la ficha. Fija el hex como la elección, y cita un motivo de `ignore-reasons.json` con una nota opcional, igual que las filas ignoradas. Los primeros descartes son la medición de Vampiric Flesh (`inconsistent-measurement`) y el gris de Corax White en la tabla muestreada (`photo-artifact`).

### Informe de discrepancias

- El builder escribe `packages/catalog-builder/reports/color-discrepancies.json`: cada pintura cuyo color publicado y algún candidato que pierde, sin descartar, están a un ΔE2000 mayor que 5. Es el límite a partir del cual docs/06 §3 deja de llamar parecidos a dos colores (`nearest-available` de `matchQuality`).
- Es determinista y se versiona, y `build-catalog --check` falla si no está al día. Una reimportación que abre o cierra una discrepancia sale en el diff de git. Nunca hace fallar el build.

## Alternativas descartadas

- **La tabla muestreada como `measured`**: el ADR-0014 reserva `measured` para un instrumento sobre la muestra, y una foto depende de la luz y del balance de blancos.
- **La tabla muestreada por detrás de la oficial**: no cambiaría ningún color, y el orden dentro de un origen solo se probaría con datos ficticios.
- **Añadir el fichero de Warhammer Colour de DonnervS**: por detrás de las dos tablas no decide nada, y su color del bote no sirve en Contrast y Shade.
- **Una elección sin hex fijado**: una reimportación cambiaría sin aviso un color elegido a mano.
- **Un hex escrito a mano**: sería un color sin fuente verificable.
- **Descartar eligiendo otro candidato**: una fuente mejor que llegue después quedaría tapada por la elección.
- **Descartes con nota libre**: el mismo motivo se escribiría distinto en cada pintura, y no se podría agrupar.
- **Mostrar las discrepancias solo bajo demanda**: una discrepancia nueva pasaría sin verse.
- **Un umbral de ΔE 10**: menos entradas, pero sin fuente que lo respalde.

## Consecuencias

- `catalog.json` no cambia de formato: sigue con un color por pintura.
- El color de la web por defecto, que es el de Moot Green, pasa de `#3daf44` a `#5d9a32`.
- El informe empieza con 108 discrepancias, casi todas entre las dos tablas de SimoGecko. Se revisan con calma, con descartes o elecciones donde haga falta.
- El paso 3 de la fase 5 (desactivación de fuentes) cae sobre la misma selección: sin la fuente desactivada, la pintura pasa a su siguiente candidato, y sus elecciones y descartes hacen fallar el build hasta que se revisan.
- El informe da cifras de ΔE con 2 decimales, como docs/06 §4. El redondeo se repite en el builder porque `domain` no lo exporta.
