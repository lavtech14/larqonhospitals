import { Suspense } from "react";

import LabReportWorkspace from "@/components/lab/LabReportWorkspace";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
  }>;
};

async function Content({ params }: Props) {
  const { id } = await params;

  return (
    <LabReportWorkspace
      key={`patient:${id}`}
      audience="patient"
      referenceId={id}
    />
  );
}

export default function PatientLabReportsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading your lab reports…
        </p>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
