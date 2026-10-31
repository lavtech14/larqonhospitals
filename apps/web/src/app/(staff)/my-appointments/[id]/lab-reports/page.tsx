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
      key={`doctor:${id}`}
      audience="doctor"
      referenceId={id}
    />
  );
}

export default function DoctorLabReportsPage(props: Props) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading released reports…
        </p>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
