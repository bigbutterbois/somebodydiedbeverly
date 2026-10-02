import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-semibold tracking-tight">Admin</h1>
      <p className="text-zinc-500">Signed in as {data?.claims.email}.</p>
      <Link href="/" className="text-sm underline">
        View the public site
      </Link>
    </div>
  );
}
