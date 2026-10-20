export const instant = false;
import AvailabilityWorkspace from "@/components/doctors/AvailabilityWorkspace";

export default async function AvailabilityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <AvailabilityWorkspace key={id} doctorId={id} />;
}
