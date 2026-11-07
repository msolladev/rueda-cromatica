# ADR-0008: Clasificación de pinturas por gama comercial, tipo funcional y acabado metálico

- **Estado:** aceptada
- **Fecha:** 2026-10-31

## Contexto
El documento del proyecto define el tipo de una pintura con los valores base, capa, lavado, contrast, metálica y técnica. Pero "metálica" es un acabado, no una función: en Citadel hay metálicas dentro de la gama Base. Además, una misma gama puede contener pinturas de distinto tipo.

## Decisión
- `Range` es la línea comercial.
- `PaintType` es la función de cada pintura: `base`, `layer`, `wash`, `contrast` o `technical`.
- `metallic: boolean` es un atributo aparte.

## Alternativas descartadas
- **Metálica como un valor más del tipo**: una base metálica perdería la información de que es base.
- **Enum de acabado (mate, metálico, brillo…)**: hoy solo se usaría "metálico". Es YAGNI y se puede migrar más adelante si hace falta.
- **Tipo a nivel de gama**: no funciona con las gamas que mezclan tipos.

## Consecuencias
- Cambia la regla de dominio del documento del proyecto.
- Los tipos que faltan (pincel seco, aerógrafo) se deciden en la fase 2. Añadir un valor al enum obliga a subir `schemaVersion`.
