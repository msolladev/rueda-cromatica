# @chromatic-wheel/domain

El dominio del catálogo de pinturas, en TypeScript puro, sin React ni navegador:

- el esquema de `catalog.json` (Zod) y los tipos del modelo que se infieren de él;
- `parseCatalog`, que valida el catálogo al cargarlo y construye el agregado `Catalog`, de solo lectura;
- las reglas derivadas, como si el color de una pintura es aproximado o cuál es su sustituta;
- la búsqueda de las pinturas más parecidas a un color, con el ΔE CIEDE2000;
- las equivalencias oficiales y la sustituta de una pintura, en sus dos direcciones y medidas contra un color, y la pintura cuyo color sustituye al de una pintura sin color;
- la búsqueda de pinturas por lo que se escribe: su nombre, su código, su marca o su gama.

Los errores esperables se devuelven como un `Result`, no se lanzan.

## Ejemplo

```ts
import {
  buildPaintIndex,
  buildPaintSearchIndex,
  findClosestPaints,
  findOfficialEquivalences,
  parseCatalog,
  searchPaints,
} from "@chromatic-wheel/domain";

const response = await fetch("/catalog.json");
const parsed = parseCatalog(await response.json());
if (!parsed.ok) throw new Error(`Invalid catalog: ${parsed.error.kind}`);

const index = buildPaintIndex(parsed.value);
const found = findClosestPaints(index, "#3daf44", { brandIds: "all" });
if (found.ok) {
  for (const { brand, matches } of found.value.byBrand) {
    console.log(
      brand.name,
      matches.map((match) => match.paint.name),
    );
  }
}

const black = parsed.value
  .paints({ brandIds: ["vallejo"], includeDiscontinued: false })
  .find((paint) => paint.manufacturerCode === "72.051");
if (black !== undefined) {
  const official = findOfficialEquivalences(parsed.value, black.id, "#000000");
  if (official.ok) {
    console.log(official.value.outgoing.map((match) => match.paint.name));
    // [«Abaddon Black»], según la CC266 de Vallejo
  }
}

const searchIndex = buildPaintSearchIndex(parsed.value);
console.log(searchPaints(searchIndex, "tigers skin")[0]?.paint.name);
// «Tiger's Eye Skin»
```

## Documentación

- Especificaciones: el modelo en [docs/01](../../docs/01-modelo-dominio.md), el formato de `catalog.json` en [docs/02](../../docs/02-esquema-catalog-json.md), los identificadores en [docs/03](../../docs/03-identificadores.md) y la búsqueda de las pinturas parecidas, las equivalencias oficiales de una pintura y la búsqueda por nombre en [docs/06](../../docs/06-pinturas-parecidas.md).
- Referencia de la API: se genera con `pnpm docs:api` ([README de la raíz](../../README.md#comandos)).
