# Esquema de `catalog.json`

## 1. Principios

- **Normalizado y plano**: una colección por entidad, con referencias por ID ([ADR-0006](adr/0006-formato-catalogo.md)).
- **Arrays, no objetos indexados por ID**: `JSON.parse` sobrescribe sin avisar las claves duplicadas, así que un ID repetido se perdería sin error. Con arrays, la unicidad se puede validar.
- **Determinista**: la misma entrada produce el mismo fichero byte a byte ([ADR-0007](adr/0007-versionado-distribucion.md)). Para ello:
  - Las colecciones se ordenan por `id`, y `equivalences` por `(from, to, sourceId)`.
  - Las claves siguen el orden de este documento.
  - Indentación de 2 espacios, UTF-8 sin BOM y salto de línea al final.
  - Ninguna marca de tiempo de generación.
- **`null` explícito** y arrays siempre presentes, aunque estén vacíos.
- **Legible en git**: se versiona con formato para que los diffs se puedan revisar. La compresión la hace el servidor HTTP.

## 2. Estructura

> Ejemplo ficticio: las marcas, pinturas, códigos y colores son inventados y solo ilustran el formato. El `…` del hash no es JSON válido.

```json
{
  "meta": {
    "schemaVersion": 1,
    "dataVersion": "sha256:…"
  },
  "sources": [
    {
      "id": "acme-conversion-chart",
      "kind": "manufacturer",
      "title": "Acme conversion chart",
      "publisher": "Acme Paints",
      "url": "https://example.com/acme-chart.pdf",
      "retrievedAt": "2026-10-31"
    }
  ],
  "brands": [
    { "id": "acme", "name": "Acme Paints" },
    { "id": "globex", "name": "Globex Colours" }
  ],
  "ranges": [
    {
      "id": "acme/classic",
      "brandId": "acme",
      "name": "Acme Classic",
      "status": "discontinued"
    },
    {
      "id": "acme/core",
      "brandId": "acme",
      "name": "Acme Core",
      "status": "active"
    },
    {
      "id": "globex/standard",
      "brandId": "globex",
      "name": "Globex Standard",
      "status": "active"
    }
  ],
  "paints": [
    {
      "id": "acme/classic/old-red",
      "rangeId": "acme/classic",
      "name": "Old Red",
      "aliases": [],
      "manufacturerCode": null,
      "type": "base",
      "metallic": false,
      "color": null,
      "status": {
        "kind": "discontinued",
        "replacement": {
          "paintId": "acme/core/deep-red",
          "sourceId": "acme-conversion-chart"
        }
      }
    },
    {
      "id": "acme/core/deep-red",
      "rangeId": "acme/core",
      "name": "Deep Red",
      "aliases": [],
      "manufacturerCode": "AC-001",
      "type": "base",
      "metallic": false,
      "color": {
        "hex": "#8a1c1c",
        "origin": "manufacturer",
        "sourceId": "acme-conversion-chart"
      },
      "status": { "kind": "active" }
    }
  ],
  "equivalences": [
    {
      "from": "acme/core/deep-red",
      "to": "globex/standard/crimson",
      "sourceId": "acme-conversion-chart"
    }
  ]
}
```

## 3. Campos y reglas

### `meta`

| Campo           | Tipo   | Reglas                                                           |
| --------------- | ------ | ---------------------------------------------------------------- |
| `schemaVersion` | entero | `≥ 1`; tiene que coincidir con la versión que soporta el cliente |
| `dataVersion`   | string | `^sha256:[0-9a-f]{64}$`                                          |

### `sources`

| Campo                | Tipo           | Reglas                                    |
| -------------------- | -------------- | ----------------------------------------- |
| `id`                 | `SourceId`     | slug ([03](03-identificadores.md)), único |
| `kind`               | enum           | `manufacturer` \| `third-party`           |
| `title`, `publisher` | string         | no vacíos                                 |
| `url`                | string \| null | URL `https://` o `null`                   |
| `retrievedAt`        | `IsoDate`      | `AAAA-MM-DD` y fecha válida               |

### `brands`

| Campo  | Tipo      | Reglas      |
| ------ | --------- | ----------- |
| `id`   | `BrandId` | slug, único |
| `name` | string    | no vacío    |

### `ranges`

| Campo     | Tipo      | Reglas                     |
| --------- | --------- | -------------------------- |
| `id`      | `RangeId` | `<brandId>/<slug>`, único  |
| `brandId` | `BrandId` | tiene que existir          |
| `name`    | string    | no vacío                   |
| `status`  | enum      | `active` \| `discontinued` |

### `paints`

| Campo                | Tipo           | Reglas                                                                                                                    |
| -------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `id`                 | `PaintId`      | `<rangeId>/<slug>`, único                                                                                                 |
| `rangeId`            | `RangeId`      | tiene que existir                                                                                                         |
| `name`               | string         | no vacío                                                                                                                  |
| `aliases`            | string[]       | sin duplicados y sin repetir `name`                                                                                       |
| `manufacturerCode`   | string \| null | si no es `null`, no puede estar vacío                                                                                     |
| `type`               | enum           | `base` \| `layer` \| `wash` \| `contrast` \| `technical`                                                                  |
| `metallic`           | boolean        |                                                                                                                           |
| `color`              | objeto \| null | `hex` con formato `^#[0-9a-f]{6}$`; `origin` es `manufacturer` \| `measured` \| `community`; `sourceId` tiene que existir |
| `status`             | objeto         | `{ kind: "active" }` o `{ kind: "discontinued", replacement }`                                                            |
| `status.replacement` | objeto \| null | `paintId` existe y es distinto de `id`; `sourceId` existe y es de tipo `manufacturer`; sin ciclos                         |

Restricción adicional: si la gama de una pintura está descatalogada, su `status.kind` tiene que ser `discontinued`.

### `equivalences`

| Campo        | Tipo       | Reglas                                         |
| ------------ | ---------- | ---------------------------------------------- |
| `from`, `to` | `PaintId`  | tienen que existir y ser distintos             |
| `sourceId`   | `SourceId` | tiene que existir y ser de tipo `manufacturer` |

La terna `(from, to, sourceId)` es única.

## 4. Versionado

### `schemaVersion`

- Es un entero. Sube cuando un cliente con la versión anterior no podría leer el fichero correctamente: un campo eliminado o renombrado, un valor nuevo en un enum o un cambio de significado.
- No sube cuando se añade un campo que los clientes antiguos pueden ignorar, porque Zod descarta las claves desconocidas.
- `domain` exporta `SUPPORTED_SCHEMA_VERSION` y el cliente solo acepta esa versión. No hay migraciones en el cliente: el builder siempre genera la versión actual.
- La app y el catálogo se despliegan juntos, así que un desajuste solo puede deberse a un error. Aun así, la comprobación es barata y evita fallos confusos.

### `dataVersion`

- Es `sha256:` seguido del hash de la serialización canónica de todo el fichero salvo `meta`. Lo calcula el builder con `node:crypto`, sin dependencias externas.
- Se usa para mostrar la versión de los datos en la interfaz, para trazabilidad y en el test de estabilidad.
- **No** lo usa el service worker (ver la sección siguiente).

### Distribución y caché

- `catalog.json` es un asset del build y entra en el **precaché de Workbox** (vite-plugin-pwa). El manifiesto guarda una revisión (un hash) por fichero, y el service worker solo vuelve a descargar el catálogo si esa revisión cambia.
- Se carga con `fetch` al arrancar, no se importa en el bundle de JS. Así no engorda el JS principal, y un cambio solo de datos no invalida el código (ni al revés).

## 5. Validación al cargarlo

### Fases

1. **Lectura**. En la web, `fetch` + `JSON.parse`; en el builder, el objeto ya está en memoria. Los errores de red o de JSON mal formado son de infraestructura y se gestionan fuera de `domain`.
2. **Control de versión**. Un esquema mínimo lee solo `meta.schemaVersion`. Si no coincide con la soportada, se devuelve error y no se intenta validar el resto.
3. **Estructura (Zod)**. Comprueba tipos, formatos y enums. Las claves desconocidas se descartan, que es el comportamiento por defecto de Zod, para tolerar campos añadidos en el futuro.
4. **Integridad e invariantes**. Una función pura de `domain` comprueba las referencias y las reglas cruzadas. Recoge **todas** las violaciones en lugar de detenerse en la primera.
5. **Construcción**. Se crea el agregado `Catalog` con sus índices.

### Contrato

```ts
type Result<T, E> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

interface CatalogIssue {
  readonly path: string; // p. ej. "paints[12].status.replacement.paintId"
  readonly message: string;
}

type CatalogParseError =
  | {
      readonly kind: "unsupported-schema-version";
      readonly found: unknown;
      readonly supported: number;
    }
  | {
      readonly kind: "invalid-structure";
      readonly issues: readonly CatalogIssue[];
    }
  | { readonly kind: "integrity"; readonly issues: readonly CatalogIssue[] };

declare function parseCatalog(
  input: unknown,
): Result<Catalog, CatalogParseError>;
```

Los errores esperables se devuelven como valor (`Result`), lo que permite tratarlos de forma exhaustiva con el tipado. Las excepciones quedan reservadas para los bugs.

### Dónde se ejecuta

| Lugar                      | Cuándo                       | Si falla                                        |
| -------------------------- | ---------------------------- | ----------------------------------------------- |
| `catalog-builder`          | antes de escribir el fichero | el build falla y no se escribe nada             |
| tests de `catalog-builder` | en CI                        | test en rojo                                    |
| `apps/web`                 | al arrancar                  | pantalla de error bloqueante, sin carga parcial |

No hay carga parcial por dos motivos. Un catálogo con referencias rotas provoca fallos sutiles lejos de su origen. Y como el builder ya aplica la misma validación, un fallo en el cliente indica un bug, no un dato erróneo que haya que tolerar.

### Tests adicionales del builder

- **Determinismo**: dos ejecuciones con la misma entrada producen el mismo `dataVersion`.
- **Estabilidad de IDs**: ver [03-identificadores.md](03-identificadores.md).

### Rendimiento

El volumen esperado es de unos pocos miles de pinturas como mucho, y la validación se hace una sola vez al arrancar. Se medirá en la fase 3 antes de optimizar nada.
