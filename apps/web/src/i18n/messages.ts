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
    /** The links that skip the navigation bar (docs/07 §11). */
    readonly skipToWheel: string;
    readonly skipToPaints: string;
    readonly skipToContent: string;
    /** Bilingual label of the language selector: «Idioma · Language». */
    readonly language: string;
    readonly theme: string;
    readonly themes: Readonly<Record<Theme, string>>;
  };
  readonly home: {
    /** The `<h1>`: what the page does, without repeating the site's name. */
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
    readonly seeLess: string;
    readonly noPaints: string;
    readonly noBrands: string;
    readonly loading: string;
    readonly details: string;
    readonly code: string;
    readonly noCode: string;
    readonly hex: string;
    /** «{hex}, de {source} ({origin})». */
    readonly hexFrom: string;
    readonly color: string;
    readonly exactColor: string;
    readonly metallic: string;
    readonly discontinued: string;
    /** The chip of the paint chosen in the search (docs/07 §15). */
    readonly chosen: string;
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
  /** The paint search above the wheel (docs/07 §15). */
  readonly search: {
    readonly label: string;
    /** Inside the empty field: what can be searched. */
    readonly placeholder: string;
    /** Always visible under the label: the minimum of letters, `{min}`. */
    readonly hint: string;
    /** Accessible name of the list of suggestions. */
    readonly paints: string;
    readonly noMatches: string;
    /** The last suggestion, which shows more: `{shown}` and `{total}`. */
    readonly seeMore: string;
    /** Announced after each search: `{shown}` and `{total}`. */
    readonly count: string;
    /** Accessible name of the button that empties the field. */
    readonly clear: string;
    /** «Back to {name}», after the wheel moved away from the paint. */
    readonly back: string;
    /** Announced when a paint becomes the base. */
    readonly chosen: string;
    /** The type of a metallic paint in a suggestion: «{type}, metallic». */
    readonly typeMetallic: string;
    /** The RYB wheel does not reach the paint: `{deltaE}`. */
    readonly rybNotice: string;
    readonly useDigital: string;
  };
  readonly paintTypes: Readonly<Record<PaintType, string>>;
  readonly quality: Readonly<Record<MatchQuality, string>>;
  readonly approximate: {
    /** The one line of the notice; the rest opens below it. */
    readonly allTitle: string;
    readonly someTitle: string;
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
    /** When «Install» is pressed before the browser offers it. */
    readonly installHint: string;
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
    /** The text of the external links: «Ver la fuente en {host}»… */
    readonly openSource: string;
    readonly openArchive: string;
    readonly openRepository: string;
    /** Said to screen readers after an external link. */
    readonly newTab: string;
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
    readonly licenseText: string;
    readonly backToWheel: string;
  };
  /** «Page not found» (docs/07 §12). */
  readonly notFound: {
    readonly title: string;
    readonly body: string;
    readonly backHome: string;
  };
  /** The footer (docs/07 §16). */
  readonly footer: {
    readonly credits: string;
    /** What the web does, under its name. */
    readonly tagline: string;
    readonly projectHeading: string;
    readonly appHeading: string;
    /** An external link: `{host}` is the site it opens. */
    readonly sourceCode: string;
    /** An external link: `{host}` is the site it opens. */
    readonly donate: string;
    readonly apiReference: string;
    /** The web is not official: the brands belong to their owners. */
    readonly disclaimer: string;
    /** `{date}`: the date of the commit the web is built from. */
    readonly version: string;
    /** An external link to that commit: `{commit}` and `{host}`. */
    readonly commit: string;
  };
}
