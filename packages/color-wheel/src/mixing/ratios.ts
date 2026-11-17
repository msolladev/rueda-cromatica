// Mix ratios (docs/05 §5). They are starting values, to be tuned after seeing
// the results in stage 5: no source gives figures.

/** How much complement the shadow contains. */
export const SHADOW_RATIO = 0.25;

/** How much lightened neighbor the light contains. */
export const LIGHT_RATIO = 0.25;

/** How much white the neighbor gets when lightened. */
export const LIGHTEN_RATIO = 0.5;

/** How much white, gray or black the monochromatic variations contain. */
export const VARIATION_RATIO = 0.5;
