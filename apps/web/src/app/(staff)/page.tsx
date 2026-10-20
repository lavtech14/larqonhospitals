export const instant = false;
import MetricCard from "@/components/dashboard/MetricCard";

const metrics = [
  {
    label: "Today's appointments",
    value: "24",
    detail: "Across all departments",
  },
  {
    label: "Waiting patients",
    value: "08",
    detail: "Currently checked in",
  },
  {
    label: "Available doctors",
    value: "06",
    detail: "On today's schedule",
  },
  {
    label: "Pending lab orders",
    value: "12",
    detail: "Awaiting processing",
  },
];

const appointments = [
  {
    id: "APT-001",
    patient: "Demo Patient A",
    doctor: "Dr. Meera",
    time: "09:30 AM",
    status: "Checked in",
    statusClass: "checked-in",
  },
  {
    id: "APT-002",
    patient: "Demo Patient B",
    doctor: "Dr. Arjun",
    time: "10:00 AM",
    status: "Booked",
    statusClass: "booked",
  },
  {
    id: "APT-003",
    patient: "Demo Patient C",
    doctor: "Dr. Meera",
    time: "10:30 AM",
    status: "Completed",
    statusClass: "completed",
  },
];

export default function DashboardPage() {
  return (
    <>
      <section className="page-heading" aria-labelledby="page-title">
        <div>
          <p className="eyebrow">YOUR DAILY WORKSPACE</p>

          <h1 id="page-title">Hospital overview</h1>

          <p className="muted">
            A clear view of appointments, patients and pending work.
          </p>
        </div>

        <span className="workspace-badge">Reception</span>
      </section>

      <section className="metrics" aria-label="Hospital activity summary">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </section>

      <section className="panel" aria-labelledby="appointments-title">
        <div className="panel-heading">
          <div>
            <h2 id="appointments-title">Todays appointments</h2>
            <p className="muted">Preview of the reception worklist.</p>
          </div>

          <span className="count-badge">3 shown</span>
        </div>

        <div
          className="table-scroll"
          role="region"
          aria-label="Appointments table"
          tabIndex={0}
        >
          <table>
            <caption className="sr-only">
              Sample appointments showing patient, doctor, time and status
            </caption>

            <thead>
              <tr>
                <th scope="col">Patient</th>
                <th scope="col">Doctor</th>
                <th scope="col">Time</th>
                <th scope="col">Status</th>
              </tr>
            </thead>

            <tbody>
              {appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <th scope="row">
                    <span className="patient-name">{appointment.patient}</span>
                    <span className="record-id">{appointment.id}</span>
                  </th>

                  <td>{appointment.doctor}</td>
                  <td>{appointment.time}</td>

                  <td>
                    <span className={`status ${appointment.statusClass}`}>
                      {appointment.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="preview-note">
        Development preview • All patient information is fictional.
      </p>
    </>
  );
}
