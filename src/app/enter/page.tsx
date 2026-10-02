import type { Metadata } from "next";
import { Monogram } from "@/components/Monogram";
import { safeNextPath } from "@/lib/site-access";
import { EnterForm } from "./EnterForm";

export const metadata: Metadata = { title: "Enter" };

export default async function EnterPage({ searchParams }: PageProps<"/enter">) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-8">
      <h1>
        <Monogram className="text-3xl" />
      </h1>
      <EnterForm next={safeNextPath(next)} />
    </main>
  );
}
