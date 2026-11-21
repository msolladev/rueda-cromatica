# ADR-0029: Buscador de pinturas en el MVP

- **Estado:** aceptada
- **Fecha:** 2026-11-21

## Contexto

La web está pensada para buscar los colores en la rueda: se elige un color y se ven las pinturas más parecidas. Pero quien pinta suele empezar por una pintura que ya tiene, y quiere saber qué combina con ella. Hasta ahora solo podía hacerlo escribiendo el hex en el campo de la rueda, que nadie se sabe.

El CLAUDE.md recogía la búsqueda por nombre con sus reglas («cuando se haga»), sin fase en la hoja de ruta. El [ADR-0019](0019-alcance-minimo-mvp.md) no la menciona.

Al estudiarlo con el catálogo de 1393 pinturas aparecieron estos datos:

- **122 nombres se repiten entre marcas** (Black, Beige, Ash Grey…), 27 dentro de la misma marca y 3 dentro de la misma gama (AK 3Gen). El código del fabricante los distingue: 1122 pinturas lo tienen, sin repetidos, y las de Citadel no.
- **La rueda RYB no alcanza todas las pinturas**: con 124 pinturas, el color alcanzado se aleja más de ΔE 1, con 25 más de 5 y con 4 más de 10, sobre todo cianes y azules intensos (Caribbean Ocean, 10,9; Lothern Blue, 8,6). El límite está en los colores de las esquinas de Gossett y Chen, no en el modelo RYB. El tono se conserva siempre (las armonías giran bien); se pierde intensidad.
- **Los filtros por defecto excluyen 476 pinturas**, entre ellas seis gamas enteras (Contrast, Shade y Technical de Citadel, Speedpaint 2.0, Quick Gen y Xpress Color). La pintura elegida no saldría entre las parecidas de su propio color.

## Decisión

### Alcance

El buscador de pinturas entra en el MVP. La tolerancia a las faltas de ortografía sigue después, como decía el CLAUDE.md.

### Búsqueda, en `domain`

- **Dónde busca**: en el nombre, los alias, el código del fabricante, la marca (con sus alias) y la gama. Cada palabra escrita tiene que estar en alguno de ellos, sin distinguir mayúsculas, acentos ni apóstrofos y por fragmentos. En el código no cuentan los separadores (`70950` encuentra `70.950`).
- **Desde 3 caracteres**: con menos, casi todo coincide.
- **Sobre todo el catálogo**, sin los filtros de los resultados: los filtros deciden qué pinturas se proponen como parecidas, no qué pinturas existen.
- **Orden**: el nombre o el código exactos; los que empiezan por lo escrito; aquellos en los que cada palabra empieza una palabra del nombre; aquellos en los que está dentro del nombre, y los encontrados solo por la marca, la gama o el código. Dentro de cada grupo, por nombre, marca, gama e ID. Va en una función propia, que la búsqueda tolerante a faltas podrá sustituir con un orden por pesos.
- **Local y síncrona**: busca en el catálogo cargado, en menos de un milisegundo, así que no hace falta retardo ni descartar búsquedas antiguas. El [ADR-0017](0017-arquitectura-objetivo-backend.md) mantiene el catálogo local también en la fase 6; el retardo y la cancelación serán necesarios en `apps/admin`, que buscará contra la API.

### Buscador, en la web

- **Encima de la rueda**, a todo su ancho, con una etiqueta y una línea de ayuda fija («Al menos 3 letras del nombre, el código o la marca»).
- **Patrón _combobox_ de la APG con [Downshift](https://github.com/downshift-js/downshift)** 9.5.0 (`useCombobox`): da el estado, el teclado y el ARIA, y la web pone el marcado y el estilo. Probado con React 19.3 y `StrictMode`, sin errores. Pesa 11,5 KB con gzip.
- **Cada sugerencia**: la muestra; el nombre y, en cursiva y atenuado, el tipo («Hammered Copper · _Estándar, metálica_»); debajo, la marca, la gama y el código. Lo escrito, en negrita.
- **8 sugerencias**, y una última, «Ver más pinturas (8 de 83)», con el aspecto de «Ver más pinturas» de los resultados, que añade 8 más. La lista flota sobre la página y se desplaza por dentro solo si se piden más de las que caben.
- **Al elegir una**: la rueda viaja a su color, la web pasa a la pestaña Base y, bajo el campo, aparecen la marca, la gama y el código. La pastilla de la rueda sigue diciendo «Base»: con la marca no cabe en el móvil.
- **Si la base cambia** (arrastrando, con el teclado o con el campo Hex), el campo se vacía y aparece «Volver a…». Cambiar de armonía, de luz o de modelo no cambia la base.
- **La pintura elegida va siempre la primera de su marca** en la pestaña Base, y en «Las más parecidas», aunque los filtros la excluyan o su marca esté desmarcada, sin repetirse, con la ficha «Elegida».
- **Si la rueda RYB no la alcanza** (ΔE mayor que 1), un aviso bajo el campo lo dice y ofrece la rueda digital, donde la base vuelve a ser exactamente la pintura ([ADR-0021](0021-cambio-modelo-conserva-color.md)).
- **Se guarda** en las preferencias, con su hex.

### Movimiento

- **La rueda viaja a la nueva base** en 450 ms, con la curva de la plantilla, cuando la base cambia desde fuera de la rueda: su color, el campo Hex, el buscador o el modelo. Al cambiar de modelo, el anillo anterior se funde con el nuevo. Arrastrar y las teclas de la rueda siguen respondiendo al momento.
- **Lo que sigue a la rueda llega con ella**: las muestras de las pestañas y del panel se funden en el mismo tiempo y con la misma curva; las filas entran como al cambiar de pestaña; las pestañas que añade una armonía crecen y las que sobran se desvanecen.

## Alternativas descartadas

- **Pasar a la rueda digital al elegir una pintura que RYB no alcanza**: cambia una elección del usuario sin pedírsela, lo mismo que rechazó el ADR-0021.
- **Calcular las armonías desde el hex de la pintura aunque RYB no lo alcance**: el punto del triángulo no correspondería a la base, y la rueda tendría que saber de pinturas.
- **Cambiar las esquinas de RYB por un azul más vivo**: no hay una fuente que lo respalde, y cambiaría todas las armonías.
- **Aplicar los filtros a la búsqueda**: 476 pinturas y seis gamas enteras no se podrían encontrar con los filtros por defecto.
- **Una fila fija con la pintura elegida sobre los resultados, o un aviso cuando los filtros la excluyen**: ocupan espacio, y la fila repetiría la pintura.
- **Añadir el tipo o «Metálicas» a los filtros al elegir la pintura**: cambia los filtros sin que el usuario lo haga.
- **El desplegable nativo (`<datalist>`)**: solo encuentra el principio del valor y no se puede estilar.
- **Hacer el _combobox_ a mano**: sin dependencias, pero es el control más delicado de la web, y Downshift resuelve el foco, la lista activa y la salida del campo.
- **React Aria Components**: la referencia en accesibilidad, pero trae `react-aria`, `react-stately` y varias librerías de internacionalización para un solo control. **Headless UI**, sin versión desde abril de 2026, y **Ariakit**, aún en 0.x.

## Consecuencias

- `domain` gana la búsqueda por nombre (docs/06 §9), la pintura fijada de la búsqueda de parecidas (docs/06 §6.3) y la diferencia de color entre dos hex (docs/06 §2).
- `color-wheel` gana el viaje de la base y el fundido del anillo al cambiar de modelo (docs/05 §6.2).
- La web gana el buscador (docs/07 §15) y los movimientos de docs/07 §1, y la dependencia `downshift`. Downshift prueba con React 18: cada subida de React debe pasar los tests del buscador. Tiene abiertos el [#1452](https://github.com/downshift-js/downshift/issues/1452) (el IME falla si se controla el texto del campo, así que la web no lo controla) y el [#1706](https://github.com/downshift-js/downshift/issues/1706) (puede repetir el aviso de la última elección, que aquí no tiene efecto visible).
- El CLAUDE.md pasa la búsqueda por nombre al MVP.
