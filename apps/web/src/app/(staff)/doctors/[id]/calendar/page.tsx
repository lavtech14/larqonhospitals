import DoctorCalendarWorkspace from "@/components/doctors/DoctorCalendarWorkspace";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function DoctorCalendarPage({ params }: Props) {
  const { id } = await params;

  return <DoctorCalendarWorkspace key={id} doctorId={id} />;
}
