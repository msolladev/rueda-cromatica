import type { Messages } from "../messages.ts";

export const fr: Messages = {
  meta: {
    siteName: "Roue chromatique",
    homeTitle: "Roue chromatique pour peindre des figurines",
    homeDescription:
      "Choisissez une couleur sur une roue qui fonctionne comme une vraie, avec ses harmonies et un schéma de figurine, et trouvez les peintures les plus proches de Warhammer, Vallejo, The Army Painter et AK. Fonctionne hors ligne.",
    creditsTitle: "Crédits et sources",
    creditsDescription:
      "D’où viennent les couleurs des peintures de la Roue chromatique, avec leurs licences, et le code tiers qu’elle utilise.",
  },
  nav: {
    label: "Principale",
    openMenu: "Ouvrir le menu",
    closeMenu: "Fermer le menu",
    skipToWheel: "Aller à la roue",
    skipToPaints: "Aller aux peintures",
    skipToContent: "Aller au contenu",
    language: "Langue · Language",
    theme: "Thème",
    themes: {
      system: "Système",
      light: "Clair",
      dark: "Sombre",
    },
  },
  home: {
    heading: "Trouvez la peinture de chaque couleur de votre schéma",
    intro:
      "Choisissez une couleur sur la roue et une harmonie, ou le schéma de figurine avec son ombre et sa lumière. Pour chaque couleur, le site cherche les peintures les plus proches de chaque marque.",
    wheelHeading: "Roue",
    noscript:
      "La roue interactive a besoin de JavaScript. Vous trouverez ci-dessous un exemple complet avec ses peintures.",
    resultsHeading: "Peintures proches",
    harmoniesHeading: "Les harmonies",
    harmonies: {
      complementary:
        "La couleur et son opposée sur la roue : le contraste le plus fort.",
      "split-complementary":
        "La couleur et les deux voisines de son opposée : du contraste, mais plus doux.",
      analogous: "La couleur et ses voisines sur la roue : un ensemble calme.",
      "accented-analogous":
        "Des couleurs analogues avec l’opposée en accent, pour attirer le regard.",
      triad: "Trois couleurs réparties à égale distance sur la roue.",
      square: "Quatre couleurs réparties à égale distance sur la roue.",
      rectangle:
        "Deux paires d’opposées, plus proches entre elles que dans le carré.",
      monochromatic:
        "Une seule teinte, avec plus de blanc, plus de gris ou plus de noir.",
      "miniature-scheme":
        "La base avec son ombre et sa lumière, les deux autres couleurs de sa triade et sa complémentaire.",
    },
  },
  results: {
    show: "Afficher",
    byBrand: "Par marque",
    overall: "Les plus proches",
    colors: "Couleurs",
    colorTab: "{role} {hex}",
    legendStart: "Dans chaque échantillon, ",
    legendWheel: "en haut la couleur de la roue",
    legendMiddle: " et ",
    legendPaint: "en bas celle de la peinture",
    legendEnd: ", pour les comparer.",
    seeMore: "Voir plus de peintures",
    seeLess: "Voir moins",
    noPaints: "Aucune peinture avec ces filtres.",
    noBrands: "Choisissez au moins une marque dans les filtres.",
    loading: "Chargement des peintures…",
    details: "Détails",
    code: "Code",
    noCode: "Sans code",
    hex: "Hex",
    hexFrom: "{hex}, de {source} ({origin})",
    color: "Couleur",
    exactColor: "Exacte",
    noColor: "Sans couleur",
    metallic: "Métallique",
    discontinued: "Abandonnée",
    chosen: "Choisie",
  },
  official: {
    heading: "Équivalences officielles",
    intro:
      "Ce que disent les fabricants dans leurs nuanciers, pas la couleur calculée. Chacune ne vaut que dans un sens.",
    outgoing: "Proposé pour {name}",
    incoming: "{name} est proposé pour",
    noneOutgoing: "Aucun document ne propose une autre peinture pour {name}.",
    noneIncoming: "Aucun document ne propose {name} pour une autre peinture.",
    replacement: "{name} est remplacée par",
    noReplacement:
      "Aucun document du fabricant ne nomme de remplaçante pour {name}.",
    noColorUse:
      "{name} n’a pas de couleur dans le catalogue. Utilisez une de ses équivalences comme base de la roue.",
    noColorNone:
      "{name} n’a ni couleur dans le catalogue ni équivalence publiée, donc la roue ne bouge pas.",
    none: "Aucun fabricant ne publie d’équivalence pour {name} ({label}).",
    noneInDetails: "Aucun fabricant ne la relie à une autre peinture.",
    by: "Selon {publisher}, dans {title}.",
    use: "Utiliser {name} comme base de la roue",
    useShort: "Utiliser comme base",
  },
  filters: {
    title: "Filtres",
    brands: "Marques",
    allBrands: "toutes les marques",
    someBrands: "{count} marques sur {total}",
    addTypes: "Ajouter des types",
    metallic: "Métalliques",
    includeDiscontinued: "Inclure les abandonnées",
    opaqueOnly: "opaques",
    moreTypes: "opaques et {count} types de plus",
    withoutDiscontinued: "sans les abandonnées",
    withDiscontinued: "avec les abandonnées",
  },
  search: {
    label: "Partez d'une peinture que vous avez",
    placeholder: "Nom, code ou marque",
    hint: "Au moins {min} lettres.",
    paints: "Peintures",
    noMatches: "Aucune peinture ne correspond à votre saisie.",
    seeMore: "Voir plus de peintures ({shown} sur {total})",
    count: "Peintures : {shown} sur {total}.",
    clear: "Effacer la peinture",
    back: "Revenir à {name}",
    chosen: "Base : {name}, {brand} {range}.",
    typeMetallic: "{type}, métallique",
    noColor: "sans couleur",
    standInReplacement:
      "Affichage de {name}, sa remplaçante selon {publisher}.",
    standInEquivalence:
      "Affichage de {name}, son équivalent selon {publisher}.",
    rybNotice:
      "La roue RYB n'atteint pas cette couleur : elle utilise la plus proche (ΔE {deltaE}).",
    useDigital: "Utiliser la roue numérique",
  },
  paintTypes: {
    base: "Base",
    layer: "Couche",
    standard: "Standard",
    wash: "Lavis",
    ink: "Encre",
    glaze: "Glacis",
    contrast: "Contrast",
    technical: "Technique",
    dry: "Brossage à sec",
  },
  quality: {
    "near-identical": "Presque identique",
    "very-similar": "Très proche",
    similar: "Proche",
    "nearest-available": "La plus proche",
  },
  approximate: {
    allTitle: "Les couleurs sont approximatives",
    someTitle: "Certaines peintures ont une couleur approximative",
    all: "Les couleurs des peintures sont approximatives : leurs hex viennent de sources communautaires, pas de mesures. Comparez-les avec la vraie peinture avant d’acheter.",
    some: "Les peintures marquées « ≈ Approximative » ont une couleur approximative : le hex n’est pas mesuré ou la peinture ne se voit pas comme une couleur unie. Comparez-les avec la vraie peinture.",
    chip: "≈ Approximative",
    sources: "Sources",
    reasons: {
      metallic: "Approximative : elle est métallique",
      "paint-type":
        "Approximative : elle ne se voit pas comme une couleur unie",
      "community-color": "Approximative : hex communautaire",
    },
  },
  origins: {
    measured: "mesuré",
    manufacturer: "du fabricant",
    community: "communautaire",
  },
  errors: {
    networkTitle: "Impossible de télécharger les peintures.",
    networkBody: "Vérifiez la connexion.",
    retry: "Réessayer",
    versionTitle: "Une nouvelle version de l’application est disponible.",
    versionBody: "Mettez à jour pour voir les peintures.",
    update: "Mettre à jour",
    invalidTitle: "Les données des peintures ont un problème.",
    invalidBody:
      "La roue fonctionne toujours, mais on ne peut pas chercher de peintures proches. Rechargez la page plus tard.",
    technicalDetails: "Détails techniques",
  },
  pwa: {
    updateAvailable: "Une nouvelle version est disponible.",
    update: "Mettre à jour",
    installTitle: "Installez la Roue chromatique",
    installBody:
      "Elle s’ouvre depuis sa propre icône et fonctionne hors ligne.",
    installHint:
      "Votre navigateur ne la propose pas encore : installez-la depuis son menu, avec l’option « Installer ».",
    install: "Installer",
    installApp: "Installer l’application",
    iosSteps:
      "Dans Safari, touchez « Partager », puis « Sur l’écran d’accueil ».",
    close: "Fermer",
  },
  credits: {
    heading: "Crédits et sources",
    intro:
      "La Roue chromatique s’appuie sur les données et le code d’autres personnes. Voici d’où vient chaque chose et sous quelle licence.",
    sourcesHeading: "Sources des données",
    sourcesIntro:
      "Les couleurs des peintures sont les hex que publient ces sources. Aucune n’est mesurée par ce site.",
    publisher: "Publiée par",
    link: "Lien",
    archive: "Copie archivée",
    openSource: "Voir la source sur {host}",
    openArchive: "Voir la copie sur {host}",
    openRepository: "Voir le dépôt sur {host}",
    newTab: "(s’ouvre dans un nouvel onglet)",
    license: "Licence",
    unknownLicense: "Inconnue",
    termsOfUse: "Conditions d’utilisation du site",
    attribution: "Attribution",
    retrieved: "Consultée le",
    colorsOf: "Couleurs de",
    paintCount: "{count} peintures",
    replacements: "Remplacements",
    equivalences: "Équivalences officielles",
    codeHeading: "Code tiers",
    codeIntro:
      "Ce site inclut le code de ces paquets. Leurs licences exigent de reproduire l’avis de copyright et le texte de la licence, affichés dans leur langue d’origine.",
    version: "Version",
    licenseText: "Texte de la licence",
    backToWheel: "Retour à la roue",
  },
  notFound: {
    title: "Page introuvable",
    body: "Cette adresse n’existe pas sur la Roue chromatique. Le lien est peut-être mal saisi, ou la page n’existe plus.",
    backHome: "Aller à la roue",
  },
  footer: {
    credits: "Crédits et sources",
    tagline:
      "Une roue chromatique qui fonctionne comme une vraie, et les peintures les plus proches de chaque marque, même hors ligne.",
    projectHeading: "Projet",
    appHeading: "Application",
    sourceCode: "Code source sur {host}",
    donate: "Faire un don sur {host}",
    apiReference: "Référence de l’API",
    disclaimer:
      "Projet indépendant, sans lien avec Games Workshop, Vallejo, The Army Painter ni AK Interactive. Les marques et les noms des peintures appartiennent à leurs propriétaires.",
    version: "Version du {date}",
    commit: "{commit} sur {host}",
  },
};
