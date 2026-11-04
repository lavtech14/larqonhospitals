import { Suspense } from "react";

import PatientMonitoringHistory from "@/components/rpm/PatientMonitoringHistory";

type PageProps = {
  params: Promise<{ id: string }>;
};

async function HistoryContent({ params }: PageProps) {
  const { id } = await params;

  return <PatientMonitoringHistory key={id} assignmentId={id} />;
}

export default function PatientMonitoringHistoryPage({ params }: PageProps) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading reading history…
        </p>
      }
    >
      <HistoryContent params={params} />
    </Suspense>
  );
}
