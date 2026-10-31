import { Suspense } from "react";
import VitalsWorkspace from "@/components/nursing/VitalsWorkspace";

type Props = {
  params: Promise<{ id: string }>;
};

async function VitalsContent({ params }: Props) {
  const { id } = await params;

  return <VitalsWorkspace key={id} encounterId={id} />;
}

export default function VitalsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <p role="status" className="text-sm text-slate-600">
          Loading patient visit…
        </p>
      }
    >
      <VitalsContent params={params} />
    </Suspense>
  );
}
