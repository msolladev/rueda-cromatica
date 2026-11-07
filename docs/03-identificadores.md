# Identificadores

## 1. Formato

| Entidad | Formato            | Ejemplo                      |
| ------- | ------------------ | ---------------------------- |
| Marca   | `<slug>`           | `citadel`                    |
| Gama    | `<brandId>/<slug>` | `citadel/base`               |
| Pintura | `<rangeId>/<slug>` | `citadel/base/abaddon-black` |
| Fuente  | `<slug>`           | `acme-conversion-chart`      |

Los ejemplos ilustran el formato. Los IDs reales de las gamas dependen de la granularidad que se decida en la fase 2.

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

- El ID se guarda en los datos curados de `catalog-builder`, junto a la clave con la que se reconoce la pintura en cada fuente. El formato de esos datos se define en la fase 2.
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

Para distinguir entre "reformulado" y "producto nuevo" manda la fuente del fabricante. Si no lo aclara, se trata como el mismo producto y se deja anotado en los datos curados.

## 6. Bajas y lápidas

- Un ID publicado no se borra nunca: la pintura se marca como descatalogada.
- La única excepción son los errores de alta. Esos IDs se retiran mediante una lista explícita de IDs retirados (lápidas) en el builder, y un ID retirado no se reutiliza jamás.

## 7. Test de estabilidad (`catalog-builder`)

Compara el catálogo generado con el `catalog.json` versionado en el repositorio, es decir, el último publicado:

1. Todo ID anterior sigue existiendo o figura en las lápidas.
2. Ningún ID de las lápidas aparece en el catálogo nuevo.

Se aplica a pinturas, gamas, marcas y fuentes.

## 8. Uso

- El ID no se muestra en la interfaz.
- En las URLs se usa tal cual: `/paints/citadel/base/abaddon-black`. La ruta captura el ID completo como una sola cadena.
- Futuro (colección del usuario): las referencias guardadas en el dispositivo seguirán siendo válidas gracias a la regla de estabilidad.
