// Diplomat plate tracker helpers shared by the public and admin pages.
// Safe to import from client components: no server-only code here.

export type Country = {
  id: string;
  name: string;
  slug: string;
  plate_codes: string[];
};

export type PlateMatch = { country: Country; role: string | null };

const ROLE_PREFIXES: Record<string, string> = {
  D: "Diplomat",
  C: "Consul",
  S: "Staff",
};

// Finds the countries a plate belongs to. Accepts a bare two-letter country
// code ("AF"), a three-letter plate code ("DAF", "AFD") or a whole plate
// ("DAF 1234"); digits and spaces are ignored. A plate reads D, C or S plus
// the country code, or the country code plus D for UN diplomats, so a few
// three-letter codes match more than one way.
export function lookupPlate(input: string, countries: Country[]): PlateMatch[] {
  const letters = input.toUpperCase().replace(/[^A-Z]/g, "");
  const candidates: { code: string; role: string | null }[] = [];

  if (letters.length === 2) {
    candidates.push({ code: letters, role: null });
  } else if (letters.length === 3) {
    const role = ROLE_PREFIXES[letters[0]];
    if (role) candidates.push({ code: letters.slice(1), role });
    if (letters[2] === "D") candidates.push({ code: letters.slice(0, 2), role: "UN Diplomat" });
  }

  return candidates.flatMap(({ code, role }) =>
    countries
      .filter((country) => country.plate_codes.includes(code))
      .map((country) => ({ country, role })),
  );
}

// Countries whose name or plate code matches what was typed, best first.
export function searchCountries(query: string, countries: Country[]): Country[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const byPlate = lookupPlate(q, countries).map((match) => match.country);
  const startsWith = countries.filter((c) => c.name.toLowerCase().startsWith(q));
  const contains = countries.filter((c) => c.name.toLowerCase().includes(q));

  return [...new Set([...byPlate, ...startsWith, ...contains])];
}
