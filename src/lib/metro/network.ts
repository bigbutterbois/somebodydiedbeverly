// The Metrorail network as WMATA describes it: six lines, 98 stations, each
// station under its WMATA code (A01, C05…). Transfer stations that have one
// platform per level carry both codes (Metro Center is A01 on the Red level and
// C01 on the Blue/Orange/Silver level) and are keyed by the first.
//
// Station locations come live from WMATA (src/lib/metro/wmata.ts). What lives
// here is what WMATA doesn't serve in a usable form: the order of stations on
// each line, and where each station sits on the schematic diagram (x, y in
// grid units, about one station apart, with Metro Center at 0, 0).

export type LineCode = "RD" | "OR" | "SV" | "BL" | "YL" | "GR";

export type Line = { code: LineCode; name: string; color: string; stations: string[] };

/**
 * Where a station's name sits on the diagram: to the left or right, above or
 * below to one side ("tl", "tr", "bl", "br"), or slanted 45 degrees up or down
 * to the right ("ne", "se") or down to the left ("sw").
 */
export type LabelSide = "l" | "r" | "tl" | "tr" | "bl" | "br" | "ne" | "se" | "sw";

export type Station = {
  key: string;
  codes: string[];
  name: string;
  x: number;
  y: number;
  label: LabelSide;
};

// Official line colors from WMATA's map.
export const LINES: Line[] = [
  {
    code: "RD",
    name: "Red",
    color: "#bf0d3e",
    stations: [
      "A15", "A14", "A13", "A12", "A11", "A10", "A09", "A08", "A07", "A06", "A05", "A04", "A03", "A02", "A01",
      "B01", "B02", "B03", "B35", "B04", "B05", "B06", "B07", "B08", "B09", "B10", "B11",
    ],
  },
  {
    code: "OR",
    name: "Orange",
    color: "#ed8b00",
    stations: [
      "K08", "K07", "K06", "K05", "K04", "K03", "K02", "K01", "C05", "C04", "C03", "C02", "A01",
      "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10", "D11", "D12", "D13",
    ],
  },
  {
    code: "SV",
    name: "Silver",
    color: "#919d9d",
    stations: [
      "N12", "N11", "N10", "N09", "N08", "N07", "N06", "N04", "N03", "N02", "N01",
      "K05", "K04", "K03", "K02", "K01", "C05", "C04", "C03", "C02", "A01",
      "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "G01", "G02", "G03", "G04", "G05",
    ],
  },
  {
    code: "BL",
    name: "Blue",
    color: "#009cde",
    stations: [
      "J03", "J02", "C13", "C12", "C11", "C10", "C09", "C08", "C07", "C06", "C05", "C04", "C03", "C02", "A01",
      "D01", "D02", "D03", "D04", "D05", "D06", "D07", "D08", "G01", "G02", "G03", "G04", "G05",
    ],
  },
  {
    code: "YL",
    name: "Yellow",
    color: "#ffd100",
    stations: ["C15", "C14", "C13", "C12", "C11", "C10", "C09", "C08", "C07", "D03", "F02", "B01", "E01"],
  },
  {
    code: "GR",
    name: "Green",
    color: "#00b140",
    stations: [
      "F11", "F10", "F09", "F08", "F07", "F06", "F05", "F04", "D03", "F02", "B01",
      "E01", "E02", "E03", "E04", "E05", "B06", "E07", "E08", "E09", "E10",
    ],
  },
];

const s = (codes: string, name: string, x: number, y: number, label: LabelSide): Station => {
  const list = codes.split(",");
  return { key: list[0], codes: list, name, x, y, label };
};

export const STATIONS: Station[] = [
  // Red, west of downtown
  s("A15", "Shady Grove", -7, -15, "l"),
  s("A14", "Rockville", -7, -14, "l"),
  s("A13", "Twinbrook", -7, -13, "l"),
  s("A12", "North Bethesda", -7, -12, "l"),
  s("A11", "Grosvenor-Strathmore", -7, -11, "l"),
  s("A10", "Medical Center", -7, -10, "l"),
  s("A09", "Bethesda", -7, -9, "l"),
  s("A08", "Friendship Heights", -7, -8, "l"),
  s("A07", "Tenleytown-AU", -6, -7, "l"),
  s("A06", "Van Ness-UDC", -5, -6, "l"),
  s("A05", "Cleveland Park", -4, -5, "l"),
  s("A04", "Woodley Park", -3, -4, "l"),
  s("A03", "Dupont Circle", -2, -3, "l"),
  s("A02", "Farragut North", -1, -2, "l"),
  // Downtown transfers
  s("A01,C01", "Metro Center", 0, 0, "br"),
  s("B01,F01", "Gallery Place", 2, 0, "tr"),
  s("D03,F03", "L'Enfant Plaza", 2, 3, "ne"),
  // Red, east of downtown
  s("B02", "Judiciary Square", 3, 0, "se"),
  s("B03", "Union Station", 4, 0, "se"),
  s("B35", "NoMa-Gallaudet U", 5, -1, "r"),
  s("B04", "Rhode Island Ave", 6, -2, "r"),
  s("B05", "Brookland-CUA", 6, -4, "r"),
  s("B06,E06", "Fort Totten", 6, -6, "r"),
  s("B07", "Takoma", 6, -7, "l"),
  s("B08", "Silver Spring", 6, -8, "l"),
  s("B09", "Forest Glen", 6, -9, "l"),
  s("B10", "Wheaton", 6, -10, "l"),
  s("B11", "Glenmont", 6, -11, "l"),
  // Blue, Orange and Silver through downtown
  s("C02", "McPherson Square", -1, 0, "sw"),
  s("C03", "Farragut West", -2, 0, "sw"),
  s("C04", "Foggy Bottom-GWU", -3, 0, "ne"),
  s("C05", "Rosslyn", -4, 0, "ne"),
  s("D01", "Federal Triangle", 0, 1, "bl"),
  s("D02", "Smithsonian", 1, 2, "l"),
  s("D04", "Federal Center SW", 3, 3, "se"),
  s("D05", "Capitol South", 4, 3, "se"),
  s("D06", "Eastern Market", 5, 3, "se"),
  s("D07", "Potomac Ave", 6, 3, "se"),
  s("D08", "Stadium-Armory", 7, 3, "r"),
  // Orange east
  s("D09", "Minnesota Ave", 8, 2, "r"),
  s("D10", "Deanwood", 9, 1, "r"),
  s("D11", "Cheverly", 10, 0, "r"),
  s("D12", "Landover", 11, -1, "r"),
  s("D13", "New Carrollton", 12, -2, "r"),
  // Blue and Silver east
  s("G01", "Benning Road", 8, 4, "r"),
  s("G02", "Capitol Heights", 9, 5, "se"),
  s("G03", "Addison Road", 10, 5, "se"),
  s("G04", "Morgan Boulevard", 11, 5, "se"),
  s("G05", "Downtown Largo", 12, 5, "se"),
  // Orange and Silver west
  s("K01", "Court House", -5, 0, "ne"),
  s("K02", "Clarendon", -6, 0, "ne"),
  s("K03", "Virginia Square-GMU", -7, 0, "ne"),
  s("K04", "Ballston-MU", -8, 0, "ne"),
  s("K05", "East Falls Church", -9, 0, "ne"),
  s("K06", "West Falls Church", -10, 1, "l"),
  s("K07", "Dunn Loring", -11, 2, "l"),
  s("K08", "Vienna", -12, 3, "l"),
  // Silver west
  s("N01", "McLean", -10, -1, "ne"),
  s("N02", "Tysons", -11, -1, "ne"),
  s("N03", "Greensboro", -12, -1, "ne"),
  s("N04", "Spring Hill", -13, -1, "ne"),
  s("N06", "Wiehle-Reston East", -14, -1, "ne"),
  s("N07", "Reston Town Center", -15, -1, "ne"),
  s("N08", "Herndon", -16, -1, "ne"),
  s("N09", "Innovation Center", -17, -1, "ne"),
  s("N10", "Dulles Airport", -18, -1, "ne"),
  s("N11", "Loudoun Gateway", -19, -1, "ne"),
  s("N12", "Ashburn", -20, -1, "ne"),
  // Blue and Yellow south
  s("C06", "Arlington Cemetery", -5, 2, "l"),
  s("C07", "Pentagon", -3, 4, "l"),
  s("C08", "Pentagon City", -3, 5, "l"),
  s("C09", "Crystal City", -3, 6, "l"),
  s("C10", "National Airport", -3, 7, "l"),
  s("C11", "Potomac Yard", -3, 8, "l"),
  s("C12", "Braddock Road", -3, 9, "l"),
  s("C13", "King St-Old Town", -3, 10, "l"),
  s("C14", "Eisenhower Avenue", -2, 11, "r"),
  s("C15", "Huntington", -1, 12, "r"),
  s("J02", "Van Dorn Street", -4, 11, "l"),
  s("J03", "Franconia-Springfield", -5, 12, "l"),
  // Green north
  s("E01", "Mt Vernon Sq", 2, -1, "r"),
  s("E02", "Shaw-Howard U", 2, -2, "r"),
  s("E03", "U Street", 2, -3, "r"),
  s("E04", "Columbia Heights", 2, -4, "r"),
  s("E05", "Georgia Ave-Petworth", 2, -5, "r"),
  s("E07", "West Hyattsville", 7, -7, "r"),
  s("E08", "Hyattsville Crossing", 8, -8, "r"),
  s("E09", "College Park-U of Md", 9, -9, "r"),
  s("E10", "Greenbelt", 10, -10, "r"),
  // Green and Yellow south
  s("F02", "Archives", 2, 1.5, "r"),
  s("F04", "Waterfront", 2, 4, "l"),
  s("F05", "Navy Yard-Ballpark", 2, 5, "l"),
  s("F06", "Anacostia", 3, 6, "r"),
  s("F07", "Congress Heights", 4, 7, "r"),
  s("F08", "Southern Avenue", 5, 8, "r"),
  s("F09", "Naylor Road", 6, 9, "r"),
  s("F10", "Suitland", 7, 10, "r"),
  s("F11", "Branch Ave", 8, 11, "r"),
];

/** Station by key. */
export const STATION_BY_KEY = new Map(STATIONS.map((st) => [st.key, st]));

/** Station by any of its WMATA codes (C01 finds Metro Center too). */
export const STATION_BY_CODE = new Map(STATIONS.flatMap((st) => st.codes.map((c) => [c, st] as const)));

export const LINE_BY_CODE = new Map(LINES.map((l) => [l.code, l]));

/** Lines that stop at a station, in the order above. */
export function linesAt(key: string): Line[] {
  return LINES.filter((l) => l.stations.includes(key));
}
