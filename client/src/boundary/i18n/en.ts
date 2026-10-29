// Every word the app shows, in English. zh.ts must have the same keys (its type is this one's).
// Toasts keep the use cases' own wording (UC 0001–0013). Plurals follow i18next: key_one and key_other.
export const en = {
  app: {
    name: "TaxiMate",
    tagline: "Singapore driver assistant",
  },
  language: {
    EN: "English",
    ZH: "中文",
    /** The mockup's quick button, top right. */
    short: { EN: "EN", ZH: "中文" },
    switchTo: "Switch to {{language}}",
    heading: "Language",
  },
  layers: {
    label: "Map layers",
    expand: "Show the layers' names",
    collapse: "Show icons only",
    TAXI_STAND: "Taxi stands",
    TAXIS: "Nearby taxis",
    HOTSPOT: "Hotspots",
    CARPARK: "Carpark",
    FUEL: "Fuel",
    CHARGING: "Charge",
    HAWKER: "Hawker food",
  },
  toast: {
    loadFailed: {
      TAXI_STAND: "Unable to load taxi stand markers. Please check your connection.",
      TAXIS: "Unable to load nearby taxi markers. Please check your connection.",
      HOTSPOT: "Unable to load hotspot markers. Please check your connection.",
      CARPARK: "Unable to load carpark markers. Please check your connection.",
      FUEL: "Unable to load fuel station markers. Please check your connection.",
      CHARGING: "Unable to load charging point markers. Please check your connection.",
      HAWKER: "Unable to load hawker centre markers. Please check your connection.",
    },
    noHotspots: "No stations are crowded right now.",
    suggestionLoadFailed: {
      PICKUP: "Unable to load pickup markers. Please check your connection.",
      REST_STOP: "Unable to load rest stop markers. Please check your connection.",
    },
    cantCalculate: {
      PICKUP: "Unable to calculate nearby pickup spots without your location. Please try again later.",
      REST_STOP: "Unable to calculate nearby rest stops without your location. Please try again later.",
    },
    noneNearby: {
      PICKUP: "There are no ideal pickup spots nearby. Please try again later.",
      REST_STOP: "There are no ideal rest stops nearby. Please try again later.",
    },
    bookmarkAdded: "Location has been favourited",
    bookmarkRemoved: "Location has been unfavourited",
    bookmarkNotFound: "Unable to find bookmarked location. Please try again later",
  },
  map: {
    taxi: "Available taxi",
    you: "You are here",
    lastKnown: "Your last known position",
    cluster: {
      TAXI_STAND: "{{count}} taxi stands: tap to zoom in",
      TAXIS: "{{count}} available taxis: tap to zoom in",
      CARPARK: "{{count}} carparks: tap to zoom in",
      FUEL: "{{count}} fuel stations: tap to zoom in",
      CHARGING: "{{count}} charging places: tap to zoom in",
      HAWKER: "{{count}} hawker centres: tap to zoom in",
    },
    hotspot: { HIGH: "{{station}}: very crowded", MEDIUM: "{{station}}: crowded" },
    suggestionPin: {
      PICKUP: "Suggested pickup {{place}}: {{name}}",
      REST_STOP: "Suggested rest stop {{place}}: {{name}}",
    },
    highlighted: "{{name}}, from your bookmarks",
  },
  units: {
    metres: "{{n}} m",
    kilometres: "{{n}} km",
  },
  place: {
    navigate: "Navigate",
    navigateTo: "Navigate to {{name}}",
    bookmark: "Bookmark {{name}}",
    unbookmark: "Remove the bookmark for {{name}}",
    asOf: " · as of {{time}}",
    away: "{{distance}} away",
    taxiStand: { Stand: "Taxi stand", Stop: "Taxi stop" },
    barrierFree: "Barrier-free access",
    carpark: "{{agency}} carpark",
    lotsFree_one: "{{count}} lot free",
    lotsFree_other: "{{count}} lots free",
    openHours: "Open {{hours}}",
    chargers_one: "{{count}} charger",
    chargers_other: "{{count}} chargers",
    upToKw: "up to {{kw}} kW",
    dcFast: "DC fast",
    chargersFree: "{{free}} of {{total}} free",
    foodStalls_one: "{{count}} food stall",
    foodStalls_other: "{{count}} food stalls",
    closedToday: "Closed today for {{why}}, until {{date}}",
    nextClosed: "Next closed {{range}} for {{why}}",
    closure: { cleaning: "cleaning", works: "works" },
    platforms: { HIGH: "Very crowded platforms", MEDIUM: "Crowded platforms" },
  },
  summary: {
    crowd: { HIGH: "{{station}} very crowded", MEDIUM: "{{station}} crowded", LOW: "{{station}} quiet" },
    noStation: "No station nearby",
    emptyTaxis_zero: "no empty taxis nearby",
    emptyTaxis_one: "{{count}} empty taxi nearby",
    emptyTaxis_other: "{{count}} empty taxis nearby",
    food_one: "Food ({{count}} stall)",
    food_other: "Food ({{count}} stalls)",
    parking: "parking",
    parkingFree: "parking ({{count}} free)",
    fuel: "fuel",
    charging: "EV charging",
    chargingFree: "EV charging ({{count}} free)",
  },
  menu: {
    open: "Open the menu",
    label: "Menu",
    close: "Close the menu",
    back: "Back to the menu",
    suggestions: "Smart suggestions",
    bookmarks: "Bookmarks",
    settings: "Settings",
    help: "Help & support",
    finding: "Finding the best nearby…",
    entry: {
      PICKUP: { title: "Suggested pickup", subtitle: "Best place to find a fare now" },
      REST_STOP: { title: "Suggested rest stop", subtitle: "Parking, food & fuel nearby" },
    },
  },
  suggestions: {
    waiting: "Waiting for your location…",
    outOfDate: "These suggestions are out of date. Please check your connection.",
    noneWithin: {
      PICKUP: "No ideal pickup spots within {{km}} km right now.",
      REST_STOP: "No ideal rest stops within {{km}} km right now.",
    },
    scoredAt: "Scored at {{time}}",
  },
  bookmarks: {
    empty: "No bookmarks yet. Tap the star on a place's details to save it here.",
    kind: {
      TAXI_STAND: "Taxi stand",
      CARPARK: "Carpark",
      FUEL: "Fuel station",
      CHARGING: "Charging point",
      HAWKER: "Hawker centre",
    },
  },
  navigation: {
    title: "Open Google Maps?",
    text: "Get directions to {{name}} in Google Maps.",
    doNotShow: "Do not show this again",
    yes: "Yes",
    no: "No",
  },
  settings: {
    title: "Settings",
    vehicle: "What do you drive?",
    vehicleType: {
      none: { label: "Not set", hint: "Shows fuel stations and charging points" },
      FUEL: { label: "Petrol or diesel", hint: "Hides charging points" },
      EV: { label: "Electric", hint: "Hides fuel stations" },
    },
    textSize: "Text size",
    size: { normal: "Normal", large: "Large", larger: "Larger", largest: "Largest" },
    darkMode: "Dark mode",
    darkModeHint: "Dark menus and a night map",
    askBeforeMaps: "Ask before opening Google Maps",
  },
  help: {
    title: "Help & support",
    topics: {
      layers: {
        title: "Map layers",
        text: "Tap a button at the bottom to show or hide that layer. Tap a marker for its details; tap a bubble with a number to zoom in.",
      },
      suggestions: {
        title: "Smart suggestions",
        text: "In the menu, turn on Suggested pickup or Suggested rest stop. The three best places near you show on the map and in the menu; tap one to see it on the map.",
      },
      navigation: {
        title: "Directions",
        text: "Tap Navigate in a place's details for directions in Google Maps.",
      },
      bookmarks: {
        title: "Bookmarks",
        text: "Tap the star in a place's details to save it; your bookmarks are in the menu. Tap the star again to remove it.",
      },
      location: {
        title: "Your location",
        text: "Allow location to see where you are and get suggestions near you. The round button at the bottom right brings the map back to you. Your location stays on your phone.",
      },
      settings: {
        title: "Settings",
        text: "Choose the language, what you drive, the text size and dark mode.",
      },
      freshness: {
        title: "How up to date",
        text: "Taxis, crowds, free lots and chargers are updated every few minutes, and places once a day. Live figures say when they were last updated. Without a connection, the app shows what it saved.",
      },
    },
    sources: "Data sources",
    /** Shown before the licences' own statements, which stay in English as the licences word them. */
    sourcesNote: "TaxiMate uses open data from these sources:",
    about: "About",
    aboutText:
      "TaxiMate is a student project for SC2006 Software Engineering. It is not an official app, and no government agency endorses it.",
  },
  location: {
    centre: "Centre the map on my location",
    mine: "My location",
    backToMine: "Back to my location",
    region: "Location access",
    needed: "Location access required to show real-time position.",
    howTo: "How to turn it on",
    retry: "Try again",
    steps: {
      ios: [
        "Open the Settings app, then Privacy & Security, then Location Services.",
        "Turn Location Services on, then tap Safari Websites and choose While Using the App.",
        "Come back here and tap Try again.",
      ],
      android: [
        "Tap the icon left of the address bar, then Permissions (or Site settings).",
        "Set Location to Allow, and make sure the phone's Location is on.",
        "Come back here and tap Try again.",
      ],
      other: [
        "Open this site's settings in your browser (the icon left of the address).",
        "Allow Location, then tap Try again.",
      ],
    },
  },
};

/** The shape every language has. */
export type Messages = typeof en;
