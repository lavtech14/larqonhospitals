import { Suspense } from "react";

import DoctorLabOrders from "@/components/lab-orders/DoctorLabOrders";

export const instant = false;

type Props = {
  params: Promise<{
    id: string;
  }>;
};

async function Content({ params }: Props) {
  const { id } = await params;

  return <DoctorLabOrders key={id} appointmentId={id} />;
}

export default function DoctorLabOrdersPage(props: Props) {
  return (
    <Suspense
      fallback={
        <p role="status" className="p-6 text-sm text-slate-600">
          Loading lab orders…
        </p>
      }
    >
      <Content {...props} />
    </Suspense>
  );
}
