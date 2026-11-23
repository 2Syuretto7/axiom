import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { TopBar } from "@/components/chrome";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Learn" };

async function SessionGate() {
  await requireUser();
  return null;
}

/** Placeholder until the learning workspace ships in Phase 1. */
export default function Learn() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Suspense fallback={null}>
        <SessionGate />
      </Suspense>
      <TopBar />
      <main className="flex flex-1 flex-col justify-center px-4 pb-24 sm:px-8 lg:px-[12.5vw]">
        <p className="label">Status</p>
        <h1 className="mt-4 text-[28px] font-medium leading-8 tracking-[-0.01em]">Your first lessons are being written.</h1>
        <p className="lead mt-4">
          Arithmetic and first steps in Python arrive with the learning workspace. Each lesson is checked before you see it.
        </p>
        <div className="mt-8">
          <Link href="/" className="btn btn-secondary">
            Back
          </Link>
        </div>
      </main>
    </div>
  );
}
