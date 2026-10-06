const SERVICES = [
  {
    i: "🩺",
    t: "General Consultation",
    d: "Expert primary care for everyday health concerns, chronic conditions, and preventive checkups.",
  },
  {
    i: "❤️",
    t: "Cardiology",
    d: "Complete heart care including ECG, echocardiography, stress tests, and cardiac consultations.",
  },
  {
    i: "🧠",
    t: "Neurology",
    d: "Diagnosis and treatment for headaches, epilepsy, stroke recovery, and neuromuscular disorders.",
  },
  {
    i: "🦴",
    t: "Orthopedics",
    d: "Bone, joint, and spine care — from sports injuries to joint replacement surgery.",
  },
  {
    i: "👶",
    t: "Pediatrics",
    d: "Newborn to teen healthcare, including vaccinations, growth monitoring, and child specialists.",
  },
  {
    i: "🧪",
    t: "Laboratory & Pathology",
    d: "Full-service diagnostic lab with bloodwork, imaging coordination, and same-day reports.",
  },
  {
    i: "🚑",
    t: "Emergency Care",
    d: "Round-the-clock emergency department with rapid triage and trauma care.",
  },
  {
    i: "💊",
    t: "Pharmacy",
    d: "In-house pharmacy for easy prescription fulfillment with medication counseling.",
  },
];

export default function Services() {
  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-slate-900">Our Services</h1>
        <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
          Comprehensive medical care across every major discipline — all under
          one roof.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {SERVICES.map((s) => (
          <div
            key={s.t}
            className="bg-white rounded-2xl border p-6 hover:shadow-md transition"
          >
            <div className="text-4xl mb-4">{s.i}</div>
            <h3 className="text-lg font-semibold text-slate-900">{s.t}</h3>
            <p className="text-sm text-slate-600 mt-2">{s.d}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
