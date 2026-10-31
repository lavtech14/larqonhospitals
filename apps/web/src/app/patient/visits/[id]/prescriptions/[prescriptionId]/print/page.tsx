import { Suspense } from "react";

import PatientPrescriptionPrint from "@/components/patient-portal/PatientPrescriptionPrint";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
    prescriptionId: string;
  }>;
};

async function PrintContent({ params }: Props) {
  const { id, prescriptionId } = await params;

  return (
    <PatientPrescriptionPrint
      key={`${id}:${prescriptionId}`}
      visitId={id}
      prescriptionId={prescriptionId}
    />
  );
}

export default function PatientPrescriptionPrintPage(props: Props) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading your prescription…
        </p>
      }
    >
      <PrintContent {...props} />
    </Suspense>
  );
}
