import type { Messages } from "../messages.ts";

export const eu: Messages = {
  meta: {
    siteName: "Kolore-gurpila",
    homeTitle: "Kolore-gurpila miniaturak margotzeko",
    homeDescription:
      "Aukeratu kolore bat benetakoa bezalako gurpil batean, bere harmoniekin eta miniatura-eskema batekin, eta aurkitu Warhammer, Vallejo, The Army Painter eta AK markako pintura antzekoenak. Konexiorik gabe dabil.",
    creditsTitle: "Kredituak eta iturriak",
    creditsDescription:
      "Nondik datozen Kolore-gurpilaren pinturen koloreak, beren lizentziekin, eta erabiltzen duen hirugarrenen kodea.",
  },
  nav: {
    label: "Nagusia",
    openMenu: "Ireki menua",
    closeMenu: "Itxi menua",
    skipToWheel: "Joan gurpilera",
    skipToPaints: "Joan pinturetara",
    skipToContent: "Joan edukira",
    language: "Hizkuntza · Language",
    theme: "Gaia",
    themes: { system: "Sistema", light: "Argia", dark: "Iluna" },
  },
  home: {
    heading: "Aurkitu zure eskemako kolore bakoitzaren pintura",
    intro:
      "Aukeratu kolore bat gurpilean eta harmonia bat, edo miniatura-eskema, bere itzal eta argiarekin. Kolore bakoitzerako, webguneak marka bakoitzeko pintura antzekoenak bilatzen ditu.",
    wheelHeading: "Gurpila",
    noscript:
      "Gurpil interaktiboak JavaScript behar du. Azpian adibide oso bat duzu, bere pinturekin.",
    resultsHeading: "Pintura antzekoak",
    harmoniesHeading: "Harmoniak",
    harmonies: {
      complementary:
        "Kolorea eta gurpilean haren aurkakoa: kontrasterik handiena.",
      "split-complementary":
        "Kolorea eta haren aurkakoaren bi auzokideak: kontrastea, baina leunagoa.",
      analogous: "Kolorea eta gurpileko haren auzokideak: multzo lasaia.",
      "accented-analogous":
        "Analogoak, aurkakoa azentu gisa, arreta-gune bat sortzeko.",
      triad: "Hiru kolore, gurpilean distantzia berean banatuta.",
      square: "Lau kolore, distantzia berean banatuta.",
      rectangle:
        "Aurkakoen bi bikote, karratuan baino elkarrengandik hurbilago.",
      monochromatic: "Tonu bakarra, zuri, gris edo beltz gehiagorekin.",
      "miniature-scheme":
        "Oinarria bere itzal eta argiarekin, bere hirukoteko beste bi koloreak eta bere osagarria.",
    },
  },
  results: {
    show: "Erakutsi",
    byBrand: "Markaka",
    overall: "Antzekoenak",
    colors: "Koloreak",
    colorTab: "{role} {hex}",
    legendStart: "Lagin bakoitzean, ",
    legendWheel: "goian gurpileko kolorea",
    legendMiddle: " eta ",
    legendPaint: "behean pinturarena",
    legendEnd: ", alderatzeko.",
    seeMore: "Ikusi pintura gehiago",
    seeLess: "Ikusi gutxiago",
    noPaints: "Ez dago pinturarik iragazki hauekin.",
    noBrands: "Aukeratu gutxienez marka bat iragazkietan.",
    loading: "Pinturak kargatzen…",
    details: "Xehetasunak",
    code: "Kodea",
    noCode: "Koderik gabe",
    hex: "Hex",
    hexFrom: "{hex}, iturria: {source} ({origin})",
    color: "Kolorea",
    exactColor: "Zehatza",
    noColor: "Kolorerik gabe",
    metallic: "Metalikoa",
    discontinued: "Katalogotik kanpo",
    chosen: "Aukeratua",
  },
  official: {
    heading: "Baliokidetasun ofizialak",
    intro:
      "Fabrikatzaileek beren kartetan diotena, ez kalkulatutako kolorea. Bakoitzak norabide bakarrean balio du.",
    outgoing: "{name} pinturarako proposatzen da",
    incoming: "{name} hauetarako proposatzen da",
    noneOutgoing:
      "Ez dago {name} pinturarako beste pinturarik proposatzen duen dokumenturik.",
    noneIncoming:
      "Ez dago {name} beste pintura baterako proposatzen duen dokumenturik.",
    replacement: "{name} pinturaren ordezkoa",
    noReplacement:
      "Fabrikatzailearen inongo dokumentuk ez du {name} pinturaren ordezkorik izendatzen.",
    noColorUse:
      "{name} pinturak ez du kolorerik katalogoan. Erabili bere baliokideetako bat gurpilaren oinarri gisa.",
    noColorNone:
      "{name} pinturak ez du kolorerik katalogoan, ezta argitaratutako baliokiderik ere; beraz, gurpila ez da mugitzen.",
    none: "Ez dago {name} pinturaren ({label}) baliokiderik argitaratzen duen fabrikatzailerik.",
    noneInDetails:
      "Ez dago beste pintura batekin lotzen duen fabrikatzailerik.",
    by: "{publisher}(r)en arabera, hemen: {title}.",
    use: "Erabili {name} gurpilaren oinarri gisa",
    useShort: "Erabili oinarri gisa",
  },
  filters: {
    title: "Iragazkiak",
    brands: "Markak",
    allBrands: "marka guztiak",
    someBrands: "{total} markatik {count}",
    addTypes: "Gehitu motak",
    metallic: "Metalikoak",
    includeDiscontinued: "Sartu katalogotik kanpokoak",
    opaqueOnly: "opakuak",
    moreTypes: "opakuak eta beste {count} mota",
    withoutDiscontinued: "katalogotik kanpokorik gabe",
    withDiscontinued: "katalogotik kanpokoekin",
  },
  search: {
    label: "Hasi duzun pintura batetik",
    placeholder: "Izena, kodea edo marka",
    hint: "Gutxienez {min} letra.",
    paints: "Pinturak",
    noMatches: "Ez dago idatzitakoarekin bat datorren pinturarik.",
    seeMore: "Ikusi pintura gehiago ({shown}/{total})",
    count: "Pinturak: {shown}/{total}.",
    clear: "Ezabatu pintura",
    back: "Itzuli honetara: {name}",
    chosen: "Oinarria: {name}, {brand} {range}.",
    typeMetallic: "{type}, metalikoa",
    noColor: "kolorerik gabe",
    standInReplacement:
      "{name} erakusten da, {publisher}(e)ren arabera haren ordezkoa.",
    standInEquivalence:
      "{name} erakusten da, {publisher}(e)ren arabera haren baliokidea.",
    rybNotice:
      "RYB gurpilak ez du kolore hau lortzen: antzekoena erabiltzen du (ΔE {deltaE}).",
    useDigital: "Erabili gurpil digitala",
  },
  paintTypes: {
    base: "Oinarria",
    layer: "Geruza",
    standard: "Estandarra",
    wash: "Garbiketa",
    ink: "Tinta",
    glaze: "Beladura",
    contrast: "Contrast",
    technical: "Teknikoa",
    dry: "Pintzel lehorra",
  },
  quality: {
    "near-identical": "Ia berdina",
    "very-similar": "Oso antzekoa",
    similar: "Antzekoa",
    "barely-similar": "Ez oso antzekoa",
  },
  approximate: {
    allTitle: "Koloreak gutxi gorabeherakoak dira",
    someTitle: "Pintura batzuen kolorea gutxi gorabeherakoa da",
    all: "Pinturen koloreak gutxi gorabeherakoak dira: haien hex-ak komunitateko iturrietatik datoz, ez neurketetatik. Alderatu benetako pinturarekin erosi aurretik.",
    some: "«≈ Gutxi gorabehera» marka duten pinturen kolorea gutxi gorabeherakoa da: hex-a ez dago neurtuta edo pintura ez da kolore lau gisa ikusten. Alderatu benetako pinturarekin.",
    chip: "≈ Gutxi gorabehera",
    sources: "Iturriak",
    reasons: {
      metallic: "Gutxi gorabehera: metalikoa da",
      "paint-type": "Gutxi gorabehera: ez da kolore lau gisa ikusten",
      "community-color": "Gutxi gorabehera: komunitateko hex-a",
    },
  },
  origins: {
    measured: "neurtua",
    manufacturer: "fabrikatzailearena",
    community: "komunitatearena",
  },
  errors: {
    networkTitle: "Ezin izan dira pinturak deskargatu.",
    networkBody: "Egiaztatu konexioa.",
    retry: "Saiatu berriro",
    versionTitle: "Aplikazioaren bertsio berri bat dago.",
    versionBody: "Eguneratu pinturak ikusteko.",
    update: "Eguneratu",
    invalidTitle: "Pinturen datuek arazo bat dute.",
    invalidBody:
      "Gurpilak badabil, baina ezin da pintura antzekorik bilatu. Kargatu berriro orria geroago.",
    technicalDetails: "Xehetasun teknikoak",
  },
  pwa: {
    updateAvailable: "Bertsio berri bat dago.",
    update: "Eguneratu",
    installTitle: "Instalatu Kolore-gurpila",
    installBody: "Bere ikonotik irekitzen da eta konexiorik gabe dabil.",
    installHint:
      "Zure nabigatzaileak oraindik ez du eskaintzen: instalatu bere menutik, «Instalatu» aukerarekin.",
    install: "Instalatu",
    installApp: "Instalatu aplikazioa",
    iosSteps:
      "Safarin, sakatu «Partekatu» eta gero «Gehitu hasierako pantailan».",
    close: "Itxi",
  },
  credits: {
    heading: "Kredituak eta iturriak",
    intro:
      "Kolore-gurpilak beste pertsona batzuen datuak eta kodea erabiltzen ditu. Hemen dago gauza bakoitza nondik datorren eta zein lizentziarekin.",
    sourcesHeading: "Datuen iturriak",
    sourcesIntro:
      "Pinturen koloreak iturri hauek argitaratzen dituzten hex-ak dira. Webgune honek ez du bat ere neurtu.",
    publisher: "Argitaratzailea",
    link: "Esteka",
    archive: "Artxibatutako kopia",
    openSource: "Ikusi iturria {host} gunean",
    openArchive: "Ikusi kopia {host} gunean",
    openRepository: "Ikusi biltegia {host} gunean",
    newTab: "(fitxa berri batean irekitzen da)",
    license: "Lizentzia",
    unknownLicense: "Ezezaguna",
    termsOfUse: "Gunearen erabilera-baldintzak",
    attribution: "Aitortza",
    retrieved: "Kontsulta-data",
    colorsOf: "Koloreak:",
    paintCount: "{count} pintura",
    replacements: "Ordezkapenak",
    equivalences: "Baliokidetza ofizialak",
    codeHeading: "Hirugarrenen kodea",
    codeIntro:
      "Webgune honek pakete hauen kodea dakar. Haien lizentziek copyright-oharra eta lizentziaren testua erakustea eskatzen dute, jatorrizko hizkuntzan erakusten direnak.",
    version: "Bertsioa",
    licenseText: "Lizentziaren testua",
    backToWheel: "Itzuli gurpilera",
  },
  notFound: {
    title: "Ez da orria aurkitu",
    body: "Helbide hau ez dago Kolore-gurpilean. Baliteke esteka gaizki idatzita egotea edo orria jada ez egotea.",
    backHome: "Joan gurpilera",
  },
  footer: {
    credits: "Kredituak eta iturriak",
    tagline:
      "Benetakoa bezala dabilen kolore-gurpila eta marka bakoitzeko pinturarik antzekoenak, konexiorik gabe ere.",
    projectHeading: "Proiektua",
    appHeading: "Aplikazioa",
    sourceCode: "Iturburu-kodea {host} webgunean",
    donate: "Egin dohaintza {host} webgunean",
    apiReference: "APIaren erreferentzia",
    disclaimer:
      "Proiektu independentea da, eta ez du zerikusirik Games Workshop, Vallejo, The Army Painter edo AK Interactive enpresekin. Markak eta pinturen izenak beren jabeenak dira.",
    version: "{date} bertsioa",
    commit: "{commit} {host} webgunean",
  },
};
