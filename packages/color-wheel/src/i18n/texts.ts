// The texts of each locale, one JSON file per locale (docs/05 §6.5). Only the
// component reads them; their type is `Labels`, checked in `ui/labels.ts`.

import ca from "./locales/ca.json";
import de from "./locales/de.json";
import en from "./locales/en.json";
import es from "./locales/es.json";
import eu from "./locales/eu.json";
import fr from "./locales/fr.json";
import gl from "./locales/gl.json";
import it from "./locales/it.json";
import ja from "./locales/ja.json";
import ko from "./locales/ko.json";
import ptBR from "./locales/pt-BR.json";
import ru from "./locales/ru.json";
import zhHans from "./locales/zh-Hans.json";
import type { Locale } from "./locales.ts";

export const TEXTS = {
  en,
  es,
  ca,
  eu,
  gl,
  fr,
  de,
  it,
  "pt-BR": ptBR,
  ru,
  "zh-Hans": zhHans,
  ja,
  ko,
} as const satisfies Record<Locale, unknown>;
