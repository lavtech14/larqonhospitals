import Link from "next/link";
import { Suspense } from "react";

import VisitSummaryPublisher from "@/components/encounters/VisitSummaryPublisher";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

async function SummaryContent({ params }: Props) {
  const { id } = await params;

  return (
    <main className="space-y-6">
      <Link
        href={`/my-appointments/${id}/encounter`}
        className="text-sm font-semibold text-teal-800"
      >
        ← Clinical encounter
      </Link>

      <VisitSummaryPublisher key={id} appointmentId={id} />
    </main>
  );
}

export default function VisitSummaryPage(props: Props) {
  return (
    <Suspense fallback={<p role="status">Loading visit summary…</p>}>
      <SummaryContent {...props} />
    </Suspense>
  );
}
