# ADR-0021: El cambio de modelo conserva el color base

- **Estado:** aceptada
- **Fecha:** 2026-11-17
- **Corrige en parte:** [ADR-0020](0020-rueda-paquete-independiente.md)

## Contexto

El ADR-0020 dice que, al pasar de una rueda a la otra, «solo se convierte el tono»: la posición en el anillo cambia de rueda y las proporciones de blanco y negro no cambian. Y que la conversión «es exacta en los dos sentidos».

docs/05 §3.2 y el código hacen otra cosa: convierten a través del hex. Las dos formas no dan lo mismo, porque los colores puros de los dos anillos no son igual de intensos. El verde puro de RYB es `#00a833`, y el de digital, `#00ff00`.

Ejemplo, con la base `#3daf44` en RYB (171,7°, con 0,79 de puro, 0,13 de blanco y 0,08 de negro), al pasar a digital:

- conservando el tono y las proporciones, la base pasa a `#21ea2e`, un verde mucho más vivo;
- conservando el color, la base sigue siendo `#3daf44`, a 123,7° con 0,45 de puro, 0,24 de blanco y 0,31 de negro.

Con un marrón (`#8b4513`) las dos formas coinciden, pero con los verdes, los azules y los violetas la diferencia es grande.

## Decisión

- **Al cambiar de modelo, la rueda conserva el color base**, no su posición: el hex de la base se convierte a la otra rueda (docs/05 §3). El punto se mueve en el triángulo y cambian las armonías, que es lo que se quiere comparar.
- **De RYB a digital la conversión es exacta; de digital a RYB, no siempre.** Un color que el triángulo RYB no alcanza, como el cian `#00ffff`, pasa al más cercano (`#6aa6a6`).
- **El componente recuerda el último hex que se le dio** (la propiedad `color`, el campo hex, `update` o `setState`) y convierte desde él, no desde el color alcanzado. Así, ir a RYB y volver a digital recupera el cian. Al arrastrar o usar el teclado, la posición pasa a mandar y el hex recordado se olvida.

## Alternativas descartadas

- **Conservar el tono y las proporciones**, como decía el ADR-0020: cambia la base sin que el usuario lo pida. En la web, la base será a menudo el hex de una pintura, y dejaría de corresponder a ella.
- **Conservar el ángulo tal cual**: el mismo número de grados es otro color en cada rueda. El verde de RYB (171,7°) sería un turquesa en digital.
- **Convertir siempre desde el color alcanzado**: ir y volver perdería los colores que RYB no alcanza.

## Consecuencias

- La sección «Modelos RYB y digital» del ADR-0020 queda corregida por este ADR, y el ADR-0020 pasa a `aceptada; corregida en parte por ADR-0021`. El resto sigue vigente.
- docs/05 §3 ya describía la conversión a través del hex. §6 añade el comportamiento del componente al cambiar de modelo y el hex recordado.
