import { Suspense } from "react";

import RpmReadingDetails from "@/components/rpm/RpmReadingDetails";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function ReadingContent({ params }: PageProps) {
  const { id } = await params;

  return <RpmReadingDetails key={id} assignmentId={id} />;
}

export default function RpmReadingDetailsPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading patient readings…
        </p>
      }
    >
      <ReadingContent params={params} />
    </Suspense>
  );
}
