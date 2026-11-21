# Identificadores

## 1. Formato

| Entidad | Formato            | Ejemplo                      |
| ------- | ------------------ | ---------------------------- |
| Marca   | `<slug>`           | `citadel`                    |
| Gama    | `<brandId>/<slug>` | `citadel/base`               |
| Pintura | `<rangeId>/<slug>` | `citadel/base/abaddon-black` |
| Fuente  | `<slug>`           | `acme-conversion-chart`      |

Hay una gama por cada línea de venta del fabricante ([ADR-0013](adr/0013-clasificacion-pinturas.md)). El ID de una fuente identifica el documento, no su revisión: una revisión nueva conserva el ID ([ADR-0015](adr/0015-fuentes-trazabilidad-licencias.md)).

- Slug: `^[a-z0-9]+(?:-[a-z0-9]+)*$`
- Pintura: `^[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*){2}$`

## 2. Propiedades

- **Estable**: no cambia nunca una vez publicado.
- **Legible**: tiene sentido en el JSON, en los diffs, en los tests y en los logs.
- **Independiente del nombre comercial**: se deriva del nombre una sola vez, al dar de alta la pintura. Después el nombre puede cambiar y el ID no.
- **Opaco para el código**: nunca se descompone para sacar la marca o la gama; para eso están `rangeId` y `catalog.brandOf()`. El prefijo refleja la gama en el momento del alta y puede dejar de coincidir con la actual (ver los casos).

## 3. Alta y generación del slug

El slug se genera una sola vez, aplicando estos pasos al nombre:

1. Normalizar a Unicode NFKD y eliminar los diacríticos.
2. Pasar a minúsculas.
3. Eliminar los apóstrofos, para que `Bob's` dé `bobs` y no `bob-s`.
4. Sustituir cada secuencia de caracteres no alfanuméricos por `-`.
5. Quitar los guiones del principio y del final.

| Nombre           | Slug           |
| ---------------- | -------------- |
| `Rojo Óxido`     | `rojo-oxido`   |
| `Bob's Blue`     | `bobs-blue`    |
| `Grey / Green 2` | `grey-green-2` |

El generador es una utilidad del builder que **propone** el ID. El resultado se guarda en los datos curados y se versiona.

Si el slug ya existe (colisión), el builder falla y se elige a mano un sufijo con significado, por ejemplo el código del fabricante o un distintivo de la versión. Nunca se usa un contador automático.

## 4. Congelación

- El ID se guarda en el fichero de su marca, en los datos de `catalog-builder`. El formato de esos datos está en [04-datos-curados.md](04-datos-curados.md).
- El builder nunca recalcula un ID que ya existe.

## 5. Casos

| Caso                                     | ID                                 | Qué cambia                                                        |
| ---------------------------------------- | ---------------------------------- | ----------------------------------------------------------------- |
| Renombrado                               | igual                              | `name`; el nombre anterior pasa a `aliases`                       |
| Cambio de gama                           | igual (el prefijo queda desfasado) | `rangeId`                                                         |
| Mismo producto reformulado               | igual                              | `color` y su fuente                                               |
| Producto nuevo con un nombre reutilizado | nuevo (con sufijo si colisiona)    | la antigua pasa a `discontinued`, con `replacement` si hay fuente |
| Descatalogación                          | igual                              | `status`                                                          |
| Alta errónea                             | se retira (lápida)                 | —                                                                 |

Para distinguir entre "reformulado" y "producto nuevo" manda la fuente del fabricante. Si no lo aclara, se trata como el mismo producto y se deja anotado en el mensaje del commit.

Un renombrado se da por probado cuando el mismo código aparece con nombres distintos en dos documentos del fabricante. Una reseña de terceros es una pista, no una prueba. Si cambia el código y no el nombre, y el fabricante no lo aclara, también se trata como el mismo producto: cambia `manufacturerCode`, y el código anterior queda en el historial de git.

El cambio de nombre de una marca sigue la misma regla: el ID no cambia, y el nombre anterior pasa a `Brand.aliases` (p. ej., `citadel`, que ahora se llama «Warhammer Colour»).

## 6. Bajas y lápidas

- Un ID publicado no se borra nunca: la pintura se marca como descatalogada.
- La única excepción son los errores de alta. Esos IDs se retiran con una lápida en `packages/catalog-builder/data/tombstones.json`, y un ID retirado no se reutiliza jamás.
- El fichero tiene las cuatro colecciones del catálogo (`sources`, `brands`, `ranges` y `paints`), porque una marca y una fuente pueden compartir slug. Cada lápida lleva el ID y el motivo; la fecha y el commit están en git:

```json
{
  "sources": [],
  "brands": [],
  "ranges": [],
  "paints": [
    {
      "id": "citadel/base/administratum-grey",
      "reason": "Duplicate of citadel/layer/administratum-grey; it only exists in Layer."
    }
  ]
}
```

El ejemplo es hipotético: ese ID nunca ha existido.

## 7. Test de estabilidad (`catalog-builder`)

Compara el catálogo generado con el de la última publicación: el `catalog.json` de la etiqueta de git `release/` más reciente ([ADR-0025](adr/0025-estabilidad-ids-etiqueta-publicacion.md), [ADR-0028](adr/0028-produccion-homelab.md)).

1. Todo ID publicado sigue existiendo o figura en las lápidas.
2. Ningún ID de las lápidas aparece en el catálogo nuevo.

Se aplica a pinturas, gamas, marcas y fuentes.

- Lo ejecuta `build-catalog`, también con `--check`, y si falla no escribe nada. El mensaje dice cómo arreglar cada caso y, para un ID que desaparece, da la lápida lista para pegar.
- Mientras no haya ninguna etiqueta, solo se comprueba la regla 2: ningún usuario guarda IDs todavía, así que se pueden corregir libremente.
- Cada publicación en producción crea su etiqueta: `release/AAAA-MM-DD` la primera del día, con la fecha en UTC, y `release/AAAA-MM-DD.2`, `.3`… las siguientes del mismo día. La más reciente es la de fecha y número mayores. Las etiquetas de `release/` con otro formato hacen fallar el builder, y `next-release-tag` da la de una publicación nueva.
- Necesita el historial completo de git y las etiquetas. En un clon superficial, el builder falla.

## 8. Uso

- El ID no se muestra en la interfaz.
- En las URLs se usa tal cual: `/paints/citadel/base/abaddon-black`. La ruta captura el ID completo como una sola cadena.
- Futuro (colección del usuario): las referencias guardadas en el dispositivo seguirán siendo válidas gracias a la regla de estabilidad.
