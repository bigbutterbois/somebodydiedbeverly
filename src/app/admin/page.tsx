import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AdminPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-3xl font-normal tracking-tight">Admin</h1>
      <p className="text-muted">Signed in as {data?.claims.email}.</p>
      <div className="flex flex-col gap-2 text-sm">
        <Link href="/admin/plates/log" className="text-accent hover:underline">
          Log a plate
        </Link>
        <Link href="/" className="text-accent hover:underline">
          View the public site
        </Link>
      </div>
    </div>
  );
}
