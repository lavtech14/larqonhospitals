import { Suspense } from "react";

import PatientReadingForm from "@/components/rpm/PatientReadingForm";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function ReadingContent({ params }: PageProps) {
  const { id } = await params;

  return <PatientReadingForm key={id} assignmentId={id} />;
}

export default function PatientReadingPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading reading form…
        </p>
      }
    >
      <ReadingContent params={params} />
    </Suspense>
  );
}
