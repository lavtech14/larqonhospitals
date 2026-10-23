export const instant = false;
import PatientDetails from "@/components/patients/PatientDetails";

export default async function PatientDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return <PatientDetails key={id} patientId={id} />;
}
