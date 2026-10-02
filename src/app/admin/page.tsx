import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false },
};

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <form action={signOut}>
          <button type="submit" className="text-sm text-zinc-500 underline">
            Sign out
          </button>
        </form>
      </div>
      <p className="text-zinc-500">Signed in as {data?.claims.email}.</p>
    </main>
  );
}
