import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { signOut } from "../login/actions";

export const metadata: Metadata = {
  title: { template: "%s · Admin", default: "Admin" },
};

// Private side: owner only (see src/proxy.ts). Add a tool by creating its
// folder here and linking it below.
const TOOLS = [
  { href: "/admin/plates", label: "Plates" },
  { href: "/admin/blog", label: "Blog" },
  { href: "/admin/gallery", label: "Gallery" },
];

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <>
      <div className="flex items-baseline justify-between">
        <Nav home={{ href: "/admin", label: "Admin" }} links={TOOLS} />
        <form action={signOut} className="px-6">
          <button type="submit" className="text-sm text-zinc-500 underline">
            Sign out
          </button>
        </form>
      </div>
      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col p-6">
        {children}
      </main>
    </>
  );
}
