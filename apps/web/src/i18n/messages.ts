/**
 * The web's own texts (docs/07 §9). The wheel brings its own (harmonies,
 * roles, controls); the web only writes what the wheel does not have. Every
 * locale has every key: a missing text is a compilation error.
 */
import type { Harmony } from "@chromatic-wheel/color-wheel";
import type {
  ApproximationReason,
  ColorOrigin,
  MatchQuality,
  PaintType,
} from "@chromatic-wheel/domain";
import type { Theme } from "../features/theme/theme.ts";

export interface Messages {
  readonly meta: {
    /** The name of the web, in titles and the manifest. */
    readonly siteName: string;
    readonly homeTitle: string;
    readonly homeDescription: string;
    readonly creditsTitle: string;
    readonly creditsDescription: string;
  };
  readonly nav: {
    /** Accessible name of the main navigation. */
    readonly label: string;
    readonly openMenu: string;
    readonly closeMenu: string;
    /** Bilingual label of the language selector: «Idioma · Language». */
    readonly language: string;
    readonly theme: string;
    readonly themes: Readonly<Record<Theme, string>>;
  };
  readonly home: {
    readonly heading: string;
    readonly intro: string;
    readonly wheelHeading: string;
    readonly noscript: string;
    readonly resultsHeading: string;
    readonly harmoniesHeading: string;
    readonly harmonies: Readonly<Record<Harmony, string>>;
  };
  readonly results: {
    readonly show: string;
    readonly byBrand: string;
    readonly overall: string;
    readonly colors: string;
    /** «{role} {hex}», the accessible name of a color tab. */
    readonly colorTab: string;
    /** The legend of the split swatch, in three parts. */
    readonly legendStart: string;
    readonly legendWheel: string;
    readonly legendMiddle: string;
    readonly legendPaint: string;
    readonly legendEnd: string;
    readonly seeMore: string;
    readonly noPaints: string;
    readonly noBrands: string;
    readonly loading: string;
    readonly details: string;
    readonly code: string;
    readonly noCode: string;
    readonly deltaE: string;
    readonly hex: string;
    /** «{hex}, de {source} ({origin})». */
    readonly hexFrom: string;
    readonly color: string;
    readonly exactColor: string;
    readonly metallic: string;
    readonly discontinued: string;
  };
  readonly filters: {
    readonly title: string;
    readonly brands: string;
    readonly allBrands: string;
    /** «{count} de {total} marcas». */
    readonly someBrands: string;
    readonly addTypes: string;
    readonly metallic: string;
    readonly includeDiscontinued: string;
    readonly opaqueOnly: string;
    /** «opacas y {count} tipos más». */
    readonly moreTypes: string;
    readonly withoutDiscontinued: string;
    readonly withDiscontinued: string;
  };
  readonly paintTypes: Readonly<Record<PaintType, string>>;
  readonly quality: Readonly<Record<MatchQuality, string>>;
  readonly approximate: {
    readonly all: string;
    readonly some: string;
    readonly chip: string;
    readonly sources: string;
    readonly reasons: Readonly<Record<ApproximationReason, string>>;
  };
  readonly origins: Readonly<Record<ColorOrigin, string>>;
  readonly errors: {
    readonly networkTitle: string;
    readonly networkBody: string;
    readonly retry: string;
    readonly versionTitle: string;
    readonly versionBody: string;
    readonly update: string;
    readonly invalidTitle: string;
    readonly invalidBody: string;
    readonly technicalDetails: string;
  };
  readonly pwa: {
    readonly updateAvailable: string;
    readonly update: string;
    readonly installTitle: string;
    readonly installBody: string;
    readonly install: string;
    readonly installApp: string;
    readonly iosSteps: string;
    readonly close: string;
  };
  readonly credits: {
    readonly heading: string;
    readonly intro: string;
    readonly sourcesHeading: string;
    readonly sourcesIntro: string;
    readonly publisher: string;
    readonly link: string;
    readonly archive: string;
    readonly license: string;
    readonly unknownLicense: string;
    readonly termsOfUse: string;
    readonly attribution: string;
    readonly retrieved: string;
    readonly colorsOf: string;
    /** «{count} pinturas». */
    readonly paintCount: string;
    readonly replacements: string;
    readonly equivalences: string;
    readonly codeHeading: string;
    readonly codeIntro: string;
    readonly version: string;
    readonly repository: string;
    readonly licenseText: string;
    readonly backToWheel: string;
  };
  readonly footer: {
    readonly credits: string;
  };
}
