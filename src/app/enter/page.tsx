import type { Metadata } from "next";
import { safeNextPath } from "@/lib/site-access";
import { EnterForm } from "./EnterForm";

export const metadata: Metadata = { title: "Enter" };

export default async function EnterPage({ searchParams }: PageProps<"/enter">) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-2xl font-semibold tracking-tight">somebodydiedbeverly</h1>
      <EnterForm next={safeNextPath(next)} />
    </main>
  );
}
