"use server";

import { revalidatePath } from "next/cache";
import { refresh } from "@/lib/election/server";
import { ownerClient } from "@/lib/supabase/owner";

export async function refreshNow(): Promise<{ ok: boolean; message: string }> {
  await ownerClient(); // owner only
  try {
    const result = await refresh({ force: true });
    revalidatePath("/admin/election");
    return { ok: result.ran, message: result.ran ? "Refreshed." : `Skipped: ${result.reason}.` };
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
  }
}
