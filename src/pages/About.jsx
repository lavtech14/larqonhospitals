export default function About() {
  return (
    <div className="max-w-4xl mx-auto px-4 lg:px-8 py-16">
      <h1 className="text-4xl font-bold text-slate-900">
        About Larqon Hospitals
      </h1>
      <p className="mt-6 text-lg text-slate-600 leading-relaxed">
        Founded in 1995, Larqon Hospitals Hospital has grown into one of the
        region's most trusted medical institutions. Our mission is simple:
        deliver world-class healthcare with compassion, dignity, and
        transparency.
      </p>

      <div className="mt-12 grid md:grid-cols-3 gap-6">
        {[
          { n: "50,000+", l: "Patients treated" },
          { n: "120+", l: "Specialist doctors" },
          { n: "30 years", l: "Serving the community" },
        ].map((s) => (
          <div key={s.l} className="bg-blue-50 rounded-2xl p-6 text-center">
            <p className="text-3xl font-bold text-blue-700">{s.n}</p>
            <p className="text-sm text-slate-600 mt-1">{s.l}</p>
          </div>
        ))}
      </div>

      <div className="mt-12 space-y-6 text-slate-700 leading-relaxed">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Our Mission
          </h2>
          <p>
            To provide accessible, affordable, and high-quality healthcare
            services supported by cutting-edge technology and a patient-first
            culture.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Our Vision
          </h2>
          <p>
            To be the region's most trusted healthcare provider — known not just
            for outcomes, but for the way we treat every single patient.
          </p>
        </div>
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 mb-2">
            Our Values
          </h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              <b>Compassion</b> — empathy in every interaction
            </li>
            <li>
              <b>Excellence</b> — evidence-based, quality-driven care
            </li>
            <li>
              <b>Integrity</b> — transparency in pricing and treatment
            </li>
            <li>
              <b>Innovation</b> — continuous investment in modern medicine
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
