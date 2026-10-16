// The Metrorail network as WMATA describes it: six lines, 98 stations, each
// station under its WMATA code (A01, C05…). Transfer stations that have one
// platform per level carry both codes (Metro Center is A01 on the Red level and
// C01 on the Blue/Orange/Silver level) and are keyed by the first.
//
// Station locations come live from WMATA (src/lib/metro/wmata.ts). What lives
// here is what WMATA doesn't serve in a usable form: the order of stations on
// each line, and where each station sits on the schematic diagram (x, y traced
// from WMATA's official system map, about 24 apart between neighbors).

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
  s("A15", "Shady Grove", 248, 354, "l"),
  s("A14", "Rockville", 272, 378, "l"),
  s("A13", "Twinbrook", 296, 402, "l"),
  s("A12", "North Bethesda", 320, 426, "l"),
  s("A11", "Grosvenor-Strathmore", 343, 450, "l"),
  s("A10", "Medical Center", 367, 474, "l"),
  s("A09", "Bethesda", 390, 498, "l"),
  s("A08", "Friendship Heights", 413, 520, "l"),
  s("A07", "Tenleytown-AU", 429, 532, "ne"),
  s("A06", "Van Ness-UDC", 450, 534, "ne"),
  s("A05", "Cleveland Park", 465, 548, "l"),
  s("A04", "Woodley Park", 482, 566, "l"),
  s("A03", "Dupont Circle", 499, 582, "l"),
  s("A02", "Farragut North", 512, 604, "l"),
  // Downtown transfers
  s("A01,C01", "Metro Center", 558, 676, "br"),
  s("B01,F01", "Gallery Place", 622, 676, "se"),
  s("D03,F03", "L'Enfant Plaza", 622, 760, "sw"),
  // Red, east of downtown
  s("B02", "Judiciary Square", 662, 676, "se"),
  s("B03", "Union Station", 706, 658, "r"),
  s("B35", "NoMa-Gallaudet U", 706, 630, "r"),
  s("B04", "Rhode Island Ave", 706, 604, "r"),
  s("B05", "Brookland-CUA", 706, 576, "r"),
  s("B06,E06", "Fort Totten", 652, 510, "r"),
  s("B07", "Takoma", 592, 449, "r"),
  s("B08", "Silver Spring", 580, 388, "r"),
  s("B09", "Forest Glen", 580, 361, "r"),
  s("B10", "Wheaton", 580, 335, "r"),
  s("B11", "Glenmont", 580, 308, "r"),
  // Blue, Orange and Silver through downtown
  s("C02", "McPherson Square", 532, 634, "tr"),
  s("C03", "Farragut West", 488, 634, "sw"),
  s("C04", "Foggy Bottom-GWU", 462, 634, "sw"),
  s("C05", "Rosslyn", 382, 678, "l"),
  s("D01", "Federal Triangle", 558, 709, "l"),
  s("D02", "Smithsonian", 558, 734, "l"),
  s("D04", "Federal Center SW", 658, 760, "se"),
  s("D05", "Capitol South", 691, 760, "se"),
  s("D06", "Eastern Market", 720, 754, "se"),
  s("D07", "Potomac Ave", 738, 738, "se"),
  s("D08", "Stadium-Armory", 774, 730, "se"),
  // Orange east
  s("D09", "Minnesota Ave", 842, 706, "l"),
  s("D10", "Deanwood", 862, 688, "r"),
  s("D11", "Cheverly", 881, 668, "r"),
  s("D12", "Landover", 900, 650, "r"),
  s("D13", "New Carrollton", 916, 632, "r"),
  // Blue and Silver east
  s("G01", "Benning Road", 866, 736, "se"),
  s("G02", "Capitol Heights", 888, 736, "se"),
  s("G03", "Addison Road", 912, 736, "se"),
  s("G04", "Morgan Boulevard", 936, 736, "se"),
  s("G05", "Downtown Largo", 959, 736, "se"),
  // Orange and Silver west
  s("K01", "Court House", 348, 712, "sw"),
  s("K02", "Clarendon", 326, 712, "sw"),
  s("K03", "Virginia Square-GMU", 304, 712, "sw"),
  s("K04", "Ballston-MU", 280, 712, "sw"),
  s("K05", "East Falls Church", 252, 712, "sw"),
  s("K06", "West Falls Church", 211, 704, "sw"),
  s("K07", "Dunn Loring", 180, 704, "sw"),
  s("K08", "Vienna", 150, 704, "sw"),
  // Silver west
  s("N01", "McLean", 212, 686, "ne"),
  s("N02", "Tysons", 196, 670, "ne"),
  s("N03", "Greensboro", 180, 654, "ne"),
  s("N04", "Spring Hill", 164, 638, "ne"),
  s("N06", "Wiehle-Reston East", 149, 623, "ne"),
  s("N07", "Reston Town Center", 134, 608, "ne"),
  s("N08", "Herndon", 118, 592, "ne"),
  s("N09", "Innovation Center", 102, 576, "ne"),
  s("N10", "Dulles Airport", 84, 558, "ne"),
  s("N11", "Loudoun Gateway", 70, 544, "ne"),
  s("N12", "Ashburn", 56, 530, "ne"),
  // Blue and Yellow south
  s("C06", "Arlington Cemetery", 436, 800, "l"),
  s("C07", "Pentagon", 482, 862, "l"),
  s("C08", "Pentagon City", 482, 904, "l"),
  s("C09", "Crystal City", 500, 940, "l"),
  s("C10", "National Airport", 534, 960, "r"),
  s("C11", "Potomac Yard", 534, 980, "r"),
  s("C12", "Braddock Road", 535, 999, "r"),
  s("C13", "King St-Old Town", 534, 1024, "r"),
  s("C14", "Eisenhower Avenue", 542, 1060, "r"),
  s("C15", "Huntington", 542, 1098, "r"),
  s("J02", "Van Dorn Street", 408, 1040, "se"),
  s("J03", "Franconia-Springfield", 360, 1098, "l"),
  // Green north
  s("E01", "Mt Vernon Sq", 622, 644, "r"),
  s("E02", "Shaw-Howard U", 621, 610, "r"),
  s("E03", "U Street", 596, 582, "r"),
  s("E04", "Columbia Heights", 572, 553, "l"),
  s("E05", "Georgia Ave-Petworth", 597, 528, "tl"),
  s("E07", "West Hyattsville", 684, 478, "r"),
  s("E08", "Hyattsville Crossing", 704, 460, "r"),
  s("E09", "College Park-U of Md", 722, 440, "r"),
  s("E10", "Greenbelt", 742, 420, "r"),
  // Green and Yellow south
  s("F02", "Archives", 622, 710, "l"),
  s("F04", "Waterfront", 656, 846, "sw"),
  s("F05", "Navy Yard-Ballpark", 680, 846, "sw"),
  s("F06", "Anacostia", 726, 864, "sw"),
  s("F07", "Congress Heights", 742, 880, "sw"),
  s("F08", "Southern Avenue", 766, 893, "sw"),
  s("F09", "Naylor Road", 798, 888, "sw"),
  s("F10", "Suitland", 818, 908, "sw"),
  s("F11", "Branch Ave", 836, 926, "sw"),
];

/**
 * Corners the diagram's track takes between two neighboring stations, so it
 * bends where WMATA's map bends. Keyed by the two station keys in sorted order,
 * points listed going from the first to the second.
 */
export const BENDS: Record<string, [number, number][]> = {
  "A01|A02": [[528, 676], [512, 652]],
  "B02|B03": [[690, 676], [706, 662]],
  "B07|B08": [[580, 428]],
  "D08|D09": [[798, 728]],
  "B05|B06": [[706, 564]],
  "D03|F04": [[622, 828], [640, 846]],
  "C05|C06": [[400, 704], [404, 760]],
  "C04|C05": [[414, 634], [398, 646]],
  "A01|C02": [[558, 646], [548, 634]],
  "D02|D03": [[558, 746], [572, 760]],
  "C13|J02": [[520, 1040]],
  "J02|J03": [[372, 1040], [360, 1054]],
};

/** Station by key. */
export const STATION_BY_KEY = new Map(STATIONS.map((st) => [st.key, st]));

/** Station by any of its WMATA codes (C01 finds Metro Center too). */
export const STATION_BY_CODE = new Map(STATIONS.flatMap((st) => st.codes.map((c) => [c, st] as const)));

export const LINE_BY_CODE = new Map(LINES.map((l) => [l.code, l]));

/** Lines that stop at a station, in the order above. */
export function linesAt(key: string): Line[] {
  return LINES.filter((l) => l.stations.includes(key));
}
