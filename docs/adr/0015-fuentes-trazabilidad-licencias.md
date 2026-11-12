# ADR-0015: Fuentes: trazabilidad, licencias y desactivación

- **Estado:** aceptada; aplazada en parte por ADR-0019
- **Fecha:** 2026-11-07

## Contexto

Todo dato no trivial del catálogo cita una fuente. El [informe de fuentes de datos](../investigacion/2026-11-fuentes-datos.md) muestra que:

- Algunas URL oficiales dejan de funcionar; por ejemplo, la carta de GW de 2012.
- Los fabricantes publican varias revisiones del mismo documento.
- Las licencias de las fuentes son heterogéneas.

## Decisión

- **Fuentes de equivalencias**: solo se usan documentos del fabricante. `kind` indica el autor del contenido, no quién aloja la copia. Una copia de terceros solo cuenta como `manufacturer` si reproduce el fichero o la imagen original; una retranscripción no cuenta.
- **Identidad de la fuente**: el `SourceId` identifica el documento, no su revisión. Una revisión nueva conserva el ID, actualiza los metadatos y reemplaza las filas. Los documentos distintos conviven.
- **`Source` en `catalog.json`**:
  - `url`: la URL oficial (`http://` o `https://`), aunque ya no funcione, o `null` en fuentes impresas.
  - `archiveUrl`: una captura de la Wayback Machine, o `null`. Si `url` es `null`, también lo es `archiveUrl`.
  - `license`: un identificador SPDX, `terms-of-use` o `unknown`.
  - `attribution`: el texto de atribución, o `null`.
- **Solo en los datos curados**: el SHA-256 y el nombre del fichero descargado, la URL de la copia si se usó una, la revisión o el commit de origen y las notas.
- **Archivado y descarga automáticos**: el script `archive-sources` de `catalog-builder` se ejecuta a demanda, nunca en el build ni en la CI. Para cada fuente:
  - Busca o solicita una captura en la Wayback Machine.
  - Descarga el PDF desde la URL oficial a una carpeta fuera del repositorio, indicada con una variable de entorno, y anota su SHA-256.
  - Puede volver a ejecutarse sin efectos duplicados.
  - No añade dependencias: usa el `fetch` de Node.
- **Licencias**: cada fuente registra su licencia en los datos curados. El builder falla si aporta datos una fuente con `license: none`.
- **Desactivación**: cualquier fuente se puede desactivar en los datos curados sin afectar al resto.
  - Los colores pasan al siguiente candidato o a `null`.
  - Las aristas de esa fuente desaparecen.
  - Los IDs no cambian.
  - El builder informa de lo que ha cambiado.
- **Interfaz**:
  - La ficha de la pintura muestra una fuente breve del color y, en cada equivalencia oficial, quién la afirma ([ADR-0004](0004-equivalencias-dirigidas.md)).
  - Las fuentes completas, las licencias y las atribuciones van en una página aparte, «Créditos y fuentes».

## Alternativas descartadas

- **SHA-256 en el catálogo**: el usuario no puede comprobarlo, y el catálogo cambiaría cada vez que se descarga de nuevo un PDF.
- **`archiveUrl` solo en los datos curados**: cuando la URL original deje de funcionar, el usuario se quedaría sin acceso a la fuente.
- **Archivar y descargar a mano**: es un trabajo repetitivo que se puede automatizar.
- **Una fuente por revisión de un documento**: obligaría a conservar IDs de revisiones obsoletas por la regla de estabilidad.

## Consecuencias

- La carta de GW de 2012 solo entra si existe una copia fiel.
- Antes de cualquier despliegue público hay que revisar las fuentes con licencia `unknown` o `terms-of-use`.
- La pantalla de créditos y los avisos de terceros que exige la licencia MIT se implementan con la interfaz.
