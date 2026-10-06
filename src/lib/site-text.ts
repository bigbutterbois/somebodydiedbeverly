// Every piece of the public site's wording Mike can change from /admin/text:
// headings, intros, empty states, footnotes, the forecast patch notes. Numbers
// the forecast model works out stay in code; where a sentence mixes the two,
// the number comes in through a {placeholder} the page fills in.
//
// The wording here is the default. An edit is saved as a row in the site_text
// table under the same key, and "Reset to default" deletes that row. To make
// more text editable, add an entry here and read it on the page with
// getSiteText() from src/lib/supabase/site-text.ts.

type TextEntry = {
  /** Where it shows up, for grouping in the editor. */
  page: string;
  /** What it is, in the editor. */
  label: string;
  default: string;
  /**
   * short: one line. long: a paragraph. notes: paragraphs separated by a blank
   * line, "- " starts a bullet, **double asterisks** make bold.
   */
  kind: "short" | "long" | "notes";
  /** Placeholders the page fills in, like {total}. */
  fills?: string[];
};

export const SITE_TEXT = {
  // Menu
  "nav.gallery": { page: "Menu", label: "Gallery link", default: "Gallery", kind: "short" },
  "nav.blog": { page: "Menu", label: "Blog link", default: "Blog", kind: "short" },
  "nav.forecast": { page: "Menu", label: "Forecast link", default: "Forecast", kind: "short" },
  "nav.plates": { page: "Menu", label: "Plates link", default: "Plates", kind: "short" },

  // Homepage
  "home.title": { page: "Homepage", label: "Headline", default: "Election forecasting and other silly projects", kind: "short" },
  "home.intro": { page: "Homepage", label: "Line under the headline", default: "Published stuff here", kind: "long" },
  "home.seeAll": { page: "Homepage", label: "Link to each section", default: "See all →", kind: "short" },
  "home.forecast.title": { page: "Homepage", label: "Forecast section title", default: "2026 midterms forecast", kind: "short" },
  "home.forecast.chance": {
    page: "Homepage",
    label: "Forecast odds label",
    default: "Chance of winning the {chamber}",
    kind: "short",
    fills: ["chamber"],
  },
  "home.forecast.empty": { page: "Homepage", label: "Forecast, before the first run", default: "The first forecast is on its way.", kind: "long" },
  "home.blog.title": { page: "Homepage", label: "Blog section title", default: "Blog: latest posts", kind: "short" },
  "home.blog.empty": { page: "Homepage", label: "Blog, with no posts", default: "No posts yet.", kind: "long" },
  "home.gallery.title": { page: "Homepage", label: "Gallery section title", default: "Gallery", kind: "short" },
  "home.gallery.empty": { page: "Homepage", label: "Gallery, with no pieces", default: "New pieces will show up here.", kind: "long" },
  "home.plates.title": { page: "Homepage", label: "Plates section title", default: "Diplomat plate sightings", kind: "short" },
  "home.plates.count": {
    page: "Homepage",
    label: "After the plates count",
    default: "of {total} countries spotted",
    kind: "short",
    fills: ["total"],
  },

  // Forecast: shared
  "forecast.tab.both": { page: "Forecast", label: "Both tab", default: "Both", kind: "short" },
  "forecast.tab.senate": { page: "Forecast", label: "Senate tab", default: "Senate", kind: "short" },
  "forecast.tab.house": { page: "Forecast", label: "House tab", default: "House", kind: "short" },
  "forecast.map": { page: "Forecast", label: "Map section title (Senate and House)", default: "The map", kind: "short" },
  "forecast.genericBallot": {
    page: "Forecast",
    label: "Generic ballot chart title (Both and Senate)",
    default: "Generic ballot polling average",
    kind: "short",
  },
  "forecast.approval": {
    page: "Forecast",
    label: "Trump approval chart title (Both and Senate)",
    default: "Trump approval polling average",
    kind: "short",
  },

  // Forecast: Both
  "forecast.both.title": { page: "Forecast: Both", label: "Title", default: "2026 midterms", kind: "short" },
  "forecast.both.empty": {
    page: "Forecast: Both",
    label: "Before the first run",
    default: "The first House forecast is on its way. It updates every morning at 6am Eastern.",
    kind: "long",
  },
  "forecast.patchNotes": {
    page: "Forecast: Both",
    label: "Patch notes (leave empty to hide the box)",
    default: [
      "Introducing the 2026 Midterms House Election Forecast!",
      "",
      "And a few model updates…",
      "",
      "- **Trump approval:** Fixed bug in data scraping to include more polls.",
      "- **Super PAC spending:** Outside spending by super PACs now counts toward each race’s fundraising total in the fundamentals.",
      "- **Polling weights (biggest model change):** Polls are now partially adjusted to account for historical errors. This shifted most polling averages in Republicans’ favor compared to previous model runs.",
    ].join("\n"),
    kind: "notes",
  },
  "forecast.both.details": { page: "Forecast: Both", label: "Link on each chamber card", default: "Details →", kind: "short" },
  "forecast.both.seats": {
    page: "Forecast: Both",
    label: "Under each chamber card",
    default: "Democrats win {seats} of {total} seats on average.",
    kind: "long",
    fills: ["seats", "total"],
  },
  "forecast.both.control": { page: "Forecast: Both", label: "Control section title", default: "Who controls Congress", kind: "short" },
  "forecast.both.controlNote": {
    page: "Forecast: Both",
    label: "Under the control odds",
    default:
      "Both forecasts run on the same simulated national swing, so a good night for Democrats in one chamber usually means a good night in the other.",
    kind: "long",
  },
  "forecast.both.byDay": { page: "Forecast: Both", label: "Control chart title", default: "Control of Congress, by day", kind: "short" },

  // Forecast: Senate
  "forecast.senate.title": { page: "Forecast: Senate", label: "Title", default: "2026 Senate forecast", kind: "short" },
  "forecast.senate.empty": {
    page: "Forecast: Senate",
    label: "Before the first run",
    default: "The first forecast is on its way. It updates every morning at 6am Eastern.",
    kind: "long",
  },
  "forecast.senate.topline": {
    page: "Forecast: Senate",
    label: "Under the odds",
    default: "Democrats need 51 seats, since Vice President Vance breaks a 50–50 tie.",
    kind: "long",
  },
  "forecast.senate.simulations": {
    page: "Forecast: Senate",
    label: "Simulations chart title",
    default: "Democratic seats in 100 simulations",
    kind: "short",
  },
  "forecast.senate.simulationsHint": {
    page: "Forecast: Senate",
    label: "Simulations chart hint",
    default: "Hover over or tap a dot to see that simulation’s map.",
    kind: "long",
  },
  "forecast.senate.independents": {
    page: "Forecast: Senate",
    label: "Under the map, when an independent is running",
    default: "Independents running as the main challenger ({names}) count toward Democratic control.",
    kind: "long",
    fills: ["names"],
  },
  "forecast.senate.byDay": {
    page: "Forecast: Senate",
    label: "Odds chart title",
    default: "Chance of controlling the Senate, by day",
    kind: "short",
  },
  "forecast.senate.tableNote": {
    page: "Forecast: Senate",
    label: "Under the races table",
    default:
      "Chance is the favorite’s chance of winning; margin is the projected vote margin. The tipping-point race: the party that wins it and every race on its side of the table controls the Senate. (I) = incumbent · * = independent",
    kind: "long",
  },

  // Forecast: House
  "forecast.house.title": { page: "Forecast: House", label: "Title", default: "2026 House forecast", kind: "short" },
  "forecast.house.empty": {
    page: "Forecast: House",
    label: "Before the first run",
    default: "The first House forecast is on its way. It updates every morning at 6am Eastern.",
    kind: "long",
  },
  "forecast.house.topline": {
    page: "Forecast: House",
    label: "Under the odds",
    default: "Democrats need {majority} of {total} seats. Same model as the Senate forecast, run district by district.",
    kind: "long",
    fills: ["majority", "total"],
  },
  "forecast.house.simulations": {
    page: "Forecast: House",
    label: "Simulations chart title",
    default: "Democratic seats in 500 simulations",
    kind: "short",
  },
  "forecast.house.seatsMean": {
    page: "Forecast: House",
    label: "Under the simulations chart",
    default: "On average Democrats win {seats} seats.",
    kind: "long",
    fills: ["seats"],
  },
  "forecast.house.byDay": {
    page: "Forecast: House",
    label: "Odds chart title",
    default: "Chance of controlling the House, by day",
    kind: "short",
  },
  "forecast.house.competitive": {
    page: "Forecast: House",
    label: "Districts table title",
    default: "Competitive districts",
    kind: "short",
  },
  "forecast.house.tableNote": {
    page: "Forecast: House",
    label: "Under the districts table",
    default:
      "{shown} districts that aren’t Safe for either party, from most to least Democratic. Not shown: {safeD} Safe D and {safeR} Safe R. The tipping-point district: the party that wins it and every district on its side of the table controls the House. (I) = incumbent · † = new district lines for 2026 · * = independent",
    kind: "long",
    fills: ["shown", "safeD", "safeR"],
  },

  // Blog
  "blog.title": { page: "Blog", label: "Title", default: "Blog", kind: "short" },
  "blog.all": { page: "Blog", label: "All categories link", default: "All", kind: "short" },
  "blog.empty": { page: "Blog", label: "With no posts", default: "No posts yet.", kind: "long" },
  "blog.back": { page: "Blog", label: "Link under each post", default: "← All posts", kind: "short" },

  // Gallery
  "gallery.title": { page: "Gallery", label: "Title", default: "Gallery", kind: "short" },
  "gallery.empty": { page: "Gallery", label: "With no pieces", default: "New pieces will show up here.", kind: "long" },
  "gallery.back": { page: "Gallery", label: "Back link on a piece", default: "← Gallery", kind: "short" },
  "gallery.previous": { page: "Gallery", label: "Previous link", default: "← Previous", kind: "short" },
  "gallery.next": { page: "Gallery", label: "Next link", default: "Next →", kind: "short" },

  // Plates
  "plates.title": { page: "Plates", label: "Title", default: "Diplomat plates", kind: "short" },
  "plates.intro": {
    page: "Plates",
    label: "Intro",
    default: "Every country whose diplomatic license plate Mike has spotted so far.",
    kind: "long",
  },
  "plates.count": {
    page: "Plates",
    label: "After the count",
    default: "of {total} countries spotted",
    kind: "short",
    fills: ["total"],
  },
  "plates.lookup": { page: "Plates", label: "Plate lookup label", default: "Whose plate is that?", kind: "short" },
  "plates.lookupNoMatch": { page: "Plates", label: "Plate lookup, no match", default: "No country uses that code.", kind: "short" },
  "plates.checklist": { page: "Plates", label: "Checklist title", default: "Checklist", kind: "short" },
  "plates.back": { page: "Plates", label: "Back link on a country", default: "← All countries", kind: "short" },
  "plates.notSpotted": { page: "Plates", label: "Country not spotted yet", default: "Not spotted yet.", kind: "short" },
  "plates.codes": { page: "Plates", label: "Plate codes title", default: "Plate codes", kind: "short" },
} satisfies Record<string, TextEntry>;

export type TextKey = keyof typeof SITE_TEXT;

export function isTextKey(key: string): key is TextKey {
  return Object.hasOwn(SITE_TEXT, key);
}

/** Puts the page's numbers into a text's {placeholders}; unknown ones stay as typed. */
export function fillText(text: string, fills?: Record<string, string | number>) {
  if (!fills) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in fills ? String(fills[name]) : match));
}
