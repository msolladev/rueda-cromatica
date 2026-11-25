# ADR-0036: Seis tramos en la etiqueta de cercanía

- **Estado:** aceptada
- **Fecha:** 2026-11-23

## Contexto

El [ADR-0022](0022-busqueda-pinturas-parecidas.md) fijó cuatro tramos de ΔE2000 en la etiqueta de cada resultado: ≤ 1, ≤ 2, ≤ 5 y más de 5. El último se mostraba como «La más cercana», que se leía como un puesto en la lista y no como una distancia: en una marca salían tres resultados seguidos como «la más cercana», y «Parecida ΔE 3,0» aparecía encima de «La más cercana ΔE 5,4».

Además, el tramo de más de 5 juntaba una pintura a 6, que todavía puede servir, con una a 30, que es otro color. Una pintura con el mismo hex que el color buscado tampoco se distinguía de una a 0,9.

No se ha encontrado una fuente verificable para un límite por encima de 5 en ΔE2000. Las escalas que llegan a 6 o a 12 están en ΔE\*ab (CIELAB 1976), CIEDE2000 se diseñó para diferencias pequeñas, y el comité TC 1-63 de la CIE, que estudia su uso por encima de 5, no ha publicado ninguna conclusión ([informe de progreso de 2011](https://color.li.tu-berlin.de/CIE_1_63_ARP11.PDF)).

## Decisión

- **Seis tramos**, con los límites inclusivos y el ΔE redondeado a 2 decimales, como hasta ahora:

  | ΔE2000    | Etiqueta         | Texto en castellano |
  | --------- | ---------------- | ------------------- |
  | 0         | `identical`      | Idéntica            |
  | ≤ 1       | `near-identical` | Casi idéntica       |
  | ≤ 2       | `very-similar`   | Muy parecida        |
  | ≤ 5       | `similar`        | Parecida            |
  | ≤ 15      | `barely-similar` | Poco parecida       |
  | más de 15 | `different`      | Distinta            |

- **El límite de 15 es una decisión del proyecto, sin fuente**, y así lo dice docs/06 §3. Los límites de 1, 2 y 5 conservan las suyas.
- **Un color por tramo**, de cerca a lejos: verde, verde claro, ámbar, naranja pastel, rojo apagado y gris, con contraste de al menos 6:1 en los dos temas.
- **El informe de discrepancias de color** del [ADR-0031](0031-varios-candidatos-color.md) sigue en más de 5: lista lo que deja de ser parecido, sea poco parecido o distinto.

## Alternativas descartadas

- **Solo renombrar el tramo de más de 5**: deja juntas una pintura que puede servir y otra que es otro color.
- **Un límite tomado de una escala en ΔE\*ab**: las dos fórmulas no dan los mismos valores, así que la cifra no valdría como fuente.
- **Ocultar las pinturas distintas**: el ADR-0022 descartó cualquier umbral que oculte resultados, y eso no cambia.

## Consecuencias

- Corrige en parte el ADR-0022, en los tramos. El resto sigue vigente.
- La web traduce los dos textos nuevos a sus 13 idiomas.
- Cuando haya colores medidos, conviene revisar el límite de 15 con datos reales, como ya preveía el ADR-0022 para las etiquetas.
