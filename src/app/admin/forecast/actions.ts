"use server";

import { revalidatePath } from "next/cache";
import { dispatchForecast } from "@/lib/forecast-rerun";
import { ownerClient } from "@/lib/supabase/owner";

export async function rerunForecast(): Promise<{ ok: boolean; message: string }> {
  await ownerClient(); // owner only
  try {
    await dispatchForecast();
  } catch (e) {
    return { ok: false, message: `Couldn't start it. ${e instanceof Error ? e.message : ""}` };
  }
  revalidatePath("/admin/forecast");
  return { ok: true, message: "Started. A run takes about 4 minutes; reload this page after that." };
}
