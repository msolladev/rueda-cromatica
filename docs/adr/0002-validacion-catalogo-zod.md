# ADR-0002: Validación del catálogo con Zod en `domain`

- **Estado:** aceptada
- **Fecha:** 2026-10-31

## Contexto

`catalog.json` se valida dos veces con las mismas reglas: al generarlo en el builder y al cargarlo en el cliente. TypeScript no valida nada en tiempo de ejecución. Como es un proyecto de aprendizaje, se prefiere el estándar del ecosistema.

## Decisión

- Zod es la única librería de validación.
- El esquema vive en `packages/domain`, en el módulo del contrato del catálogo, y los tipos de las entidades se infieren de él (`z.infer`).
- El builder y la web usan la misma función `parseCatalog`.
- La integridad referencial es una función pura separada del esquema estructural. Es más legible y más fácil de testear que meterlo todo en refinamientos de Zod.

**Justificación de la dependencia**: Zod está mantenido, no tiene dependencias propias, es el estándar de facto, y la inferencia de tipos evita duplicar el modelo.

## Alternativas descartadas

- **Valibot**: bundle menor, pero con un ecosistema y una documentación más pequeños.
- **JSON Schema + Ajv**: es agnóstico del lenguaje, pero obliga a duplicar los tipos TS o a generarlos aparte.
- **Guardas de tipo a mano**: más código, más propenso a errores y con peores mensajes.

## Consecuencias

- `domain` pasa a depender de `zod` y `culori`. Ninguna de las dos depende de React ni del navegador, así que se respeta la regla.
- El esquema es la fuente de verdad de los tipos. Si cambia, hay que actualizar [01-modelo-dominio.md](../01-modelo-dominio.md).
- Si el tamaño del bundle llegara a importar, se valorará la variante reducida de Zod.
