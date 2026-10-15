import { errorResponse, getTrains } from "@/lib/metro/wmata";

// Every Metrorail train and where it is, for the map. Behind the friends &
// family password like every page (src/proxy.ts).
export async function GET() {
  try {
    return Response.json({ updated: new Date().toISOString(), trains: await getTrains() });
  } catch (error) {
    return errorResponse(error);
  }
}

