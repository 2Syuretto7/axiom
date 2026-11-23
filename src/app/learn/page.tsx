import type { Metadata } from "next";
import { Suspense } from "react";
import { Workspace } from "@/components/workspace/workspace";
import { requireUser } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Learn" };

async function SessionGate() {
  await requireUser();
  return null;
}

const STARTER = `# Python runs here, in your browser. Press Run.
total = 0
for n in range(1, 11):
    total = total + n

print("1 + 2 + ... + 10 =", total)
`;

/** The workspace, with a warm-up until the first lesson batch is merged. */
export default function Learn() {
  return (
    <>
      <Suspense fallback={null}>
        <SessionGate />
      </Suspense>
      <Workspace id="warm-up" breadcrumb={["Engineering", "First steps", "Warm-up"]} starterCode={STARTER}>
        <article className="prose-lesson">
          <p className="label">Warm-up</p>
          <h1>Your workspace is ready.</h1>
          <p>
            Lessons will appear on this side. On the other side is a Python editor that runs entirely in your browser, so
            results come back at once and keep working without a connection.
          </p>
          <p>
            Press <code>Run</code>, or <code>Ctrl</code> + <code>Enter</code>. Then change <code>11</code> to <code>101</code>{" "}
            and run it again. Your code is saved as you type.
          </p>
          <p>The first lessons, on arithmetic and on first steps in Python, are being written and checked now.</p>
        </article>
      </Workspace>
    </>
  );
}
