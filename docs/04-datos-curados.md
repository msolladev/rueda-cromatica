# Datos de `catalog-builder`

Este documento especifica los datos que mantiene el proyecto y cómo el builder genera `catalog.json` a partir de ellos. Es la versión del MVP ([ADR-0019](adr/0019-alcance-minimo-mvp.md)). El diseño completo, con transcripciones literales y varios candidatos de color, está aplazado; su especificación está en el [historial](https://github.com/msolladev/rueda-cromatica/blob/df060b3/docs/04-datos-curados.md).

## 1. Principios

- **La misma forma que `catalog.json`**: cada fuente, marca, gama y pintura se guarda tal como irá al catálogo, con las reglas de [02-esquema-catalog-json.md](02-esquema-catalog-json.md) §3. Se valida con los esquemas de `domain`, sin un esquema propio.
- **JSON formateado con Prettier**, con `null` explícito y arrays siempre presentes.
- **El builder falla en lugar de adivinar**, y no escribe nada si algo no cuadra.
- **La revisión es el diff de git**: los cambios en los datos se revisan antes del commit.

## 2. Estructura

```
packages/catalog-builder/data/
  sources.json
  brands/<brand-id>.json
```

- `sources.json` es un array de fuentes.
- `brands/<brand-id>.json` es un objeto con tres claves: `brand` (la marca), `ranges` (sus gamas) y `paints` (sus pinturas).
- Cada fichero de marca solo contiene lo suyo:
  - el nombre del fichero coincide con `brand.id`;
  - el `brandId` de cada gama es el de la marca;
  - el `rangeId` de cada pintura es una gama del mismo fichero.
- Los ficheros se leen en orden alfabético.

## 3. Proceso del builder

Se ejecuta a demanda, cada vez que cambian los datos. `catalog.json` se versiona en el repositorio, y la CI lo vuelve a generar y falla si no coincide con el versionado (paso 4 del [ADR-0011](adr/0011-ci-cd.md)).

1. **Carga y validación** de los ficheros con los esquemas de `domain` y las reglas de §2.
2. **Ensamblado**: junta las fuentes, marcas, gamas y pinturas, y las ordena como exige docs/02 §1. Las equivalencias van vacías en el MVP.
3. **`meta`**: `schemaVersion` es `SUPPORTED_SCHEMA_VERSION`, y `dataVersion` se calcula según docs/02 §4.
4. **Validación final** con `parseCatalog`.
5. **Escritura** determinista de `apps/web/public/catalog.json` (docs/02 §1). El fichero está excluido de Prettier, porque su formato lo fija el builder.

## 4. Importadores

Se ejecutan a demanda, nunca en el build ni en la CI. Cada importador corresponde a una fuente.

- **Lógica pura**: recibe el contenido de la fuente ya leído y devuelve sus pinturas. No accede al disco ni a la red.
- **Script**: lee la fuente, ejecuta la lógica y actualiza el fichero de la marca.
- **IDs**:
  - Una pintura que ya existe conserva su ID. Se reconoce por el código del fabricante dentro de la misma gama o, si no tiene código, por el nombre.
  - Para una pintura nueva se propone un ID según [03-identificadores.md](03-identificadores.md) §3. Si colisiona, el importador falla y el sufijo se elige a mano.
- **Pinturas que desaparecen de la fuente**: no se borran. El importador las lista para que Miguel decida.
- **Color**:
  - El hex se normaliza a minúsculas.
  - Un degradado se reduce a su punto medio en CIELAB con blanco D65 y se recorta canal a canal si cae fuera de sRGB ([ADR-0014](adr/0014-origen-seleccion-color.md)).
  - El origen (`manufacturer`, `measured` o `community`) lo fija cada importador según quién publica la fuente.
