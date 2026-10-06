import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  ShieldCheck,
  Clock,
  HeartPulse,
  Activity,
  Stethoscope,
  Baby,
  Bone,
  Brain,
  FlaskConical,
  Ambulance,
  Star,
  CheckCircle2,
  Users,
  Award,
  Phone,
} from "lucide-react";

const SPECIALTIES = [
  {
    icon: HeartPulse,
    name: "Cardiology",
    desc: "Heart & vascular care",
    color: "text-red-600 bg-red-50",
  },
  {
    icon: Brain,
    name: "Neurology",
    desc: "Brain & nervous system",
    color: "text-purple-600 bg-purple-50",
  },
  {
    icon: Bone,
    name: "Orthopedics",
    desc: "Bones & joints",
    color: "text-amber-600 bg-amber-50",
  },
  {
    icon: Baby,
    name: "Pediatrics",
    desc: "Child healthcare",
    color: "text-pink-600 bg-pink-50",
  },
  {
    icon: Activity,
    name: "Pulmonology",
    desc: "Lungs & breathing",
    color: "text-cyan-600 bg-cyan-50",
  },
  {
    icon: FlaskConical,
    name: "Pathology",
    desc: "Lab & diagnostics",
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    icon: Stethoscope,
    name: "General Medicine",
    desc: "Primary care",
    color: "text-blue-600 bg-blue-50",
  },
  {
    icon: Ambulance,
    name: "Emergency",
    desc: "24/7 trauma care",
    color: "text-rose-600 bg-rose-50",
  },
];

const WHY_US = [
  {
    icon: Award,
    title: "Experienced Team",
    desc: "Board-certified specialists with 15+ years of average experience across all disciplines.",
  },
  {
    icon: Clock,
    title: "Fast Appointments",
    desc: "Book online and see a doctor within 24 hours — guaranteed. No more waiting weeks.",
  },
  {
    icon: ShieldCheck,
    title: "Modern Diagnostics",
    desc: "In-house lab, imaging, and pathology with same-day reports and secure digital access.",
  },
];

const TESTIMONIALS = [
  {
    name: "Priya Sharma",
    role: "Cardiology Patient",
    text: "The care I received was exceptional. From the first consultation to the follow-up, everything was smooth and professional.",
    rating: 5,
  },
  {
    name: "Rajesh Kumar",
    role: "Orthopedic Patient",
    text: "I was back on my feet within weeks after my knee surgery. The team genuinely cared about my recovery.",
    rating: 5,
  },
  {
    name: "Anita Desai",
    role: "Pediatric Parent",
    text: "As a parent, I trust MediCare completely. Their pediatricians are patient, kind, and incredibly knowledgeable.",
    rating: 5,
  },
];

const STEPS = [
  {
    icon: Calendar,
    title: "Book Online",
    desc: "Choose your doctor, pick a slot, confirm in 30 seconds.",
  },
  {
    icon: Stethoscope,
    title: "Meet Your Doctor",
    desc: "In-person or teleconsultation — your choice.",
  },
  {
    icon: FlaskConical,
    title: "Get Diagnosed",
    desc: "Lab tests and imaging with same-day results.",
  },
  {
    icon: CheckCircle2,
    title: "Feel Better",
    desc: "Prescriptions, follow-ups, and care that continues.",
  },
];

export default function Home() {
  return (
    <div>
      {/* ─── HERO ─────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-50 via-white to-slate-50">
        {/* Decorative blobs */}
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-brand-200/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-200/30 rounded-full blur-3xl" />

        <div className="relative max-w-7xl mx-auto px-4 lg:px-8 py-16 lg:py-24 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 bg-white border border-brand-200 rounded-full px-3.5 py-1.5 text-xs font-medium text-brand-700 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full rounded-full bg-brand-500 opacity-75 animate-ping" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-500" />
              </span>
              Trusted by 50,000+ patients
            </div>

            <h1 className="mt-6 text-4xl md:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.1] tracking-tight">
              Compassionate care,
              <br />
              <span className="bg-gradient-to-r from-brand-600 to-purple-600 bg-clip-text text-transparent">
                modern medicine.
              </span>
            </h1>

            <p className="mt-6 text-lg text-slate-600 max-w-xl leading-relaxed">
              From preventive checkups to advanced surgery, our team of
              specialists is here for you and your family — every step of the
              way.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg shadow-brand-600/20 transition-all active:scale-95"
              >
                Book Appointment <ArrowRight size={18} />
              </Link>
              <Link
                to="/services"
                className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:border-slate-400 text-slate-700 px-6 py-3 rounded-xl font-semibold transition-all"
              >
                Explore Services
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-500">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-green-600" />
                <span>24/7 emergency</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-green-600" />
                <span>Insurance accepted</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 size={16} className="text-green-600" />
                <span>Digital records</span>
              </div>
            </div>
          </div>

          {/* Hero visual — floating stat cards */}
          <div className="relative">
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Main card */}
              <div className="absolute inset-0 bg-gradient-to-br from-brand-500 to-brand-700 rounded-[2.5rem] shadow-2xl shadow-brand-600/30 p-8 flex flex-col items-center justify-center text-white">
                <div className="text-[120px] leading-none mb-4">🏥</div>
                <p className="text-brand-100 text-sm text-center">
                  Your health, our priority
                </p>
              </div>

              {/* Floating stat 1 */}
              <div className="absolute -top-4 -left-8 bg-white rounded-2xl shadow-xl border p-4 w-44">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                    <HeartPulse size={20} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">98%</p>
                    <p className="text-xs text-slate-500">Recovery rate</p>
                  </div>
                </div>
              </div>

              {/* Floating stat 2 */}
              <div className="absolute -bottom-4 -right-8 bg-white rounded-2xl shadow-xl border p-4 w-48">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
                    <Users size={20} className="text-brand-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-slate-900">120+</p>
                    <p className="text-xs text-slate-500">Expert doctors</p>
                  </div>
                </div>
              </div>

              {/* Floating stat 3 */}
              <div className="absolute top-1/2 -right-10 bg-white rounded-2xl shadow-xl border p-3 w-40 hidden lg:block">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                    <Star size={16} className="text-amber-600 fill-amber-500" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-900">4.9/5</p>
                    <p className="text-[10px] text-slate-500">Patient rating</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STATS BAND ──────────────────────────────── */}
      <section className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { n: "50,000+", l: "Patients treated" },
            { n: "120+", l: "Specialist doctors" },
            { n: "25+", l: "Departments" },
            { n: "30 yrs", l: "Of trusted care" },
          ].map((s) => (
            <div key={s.l} className="text-center">
              <p className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-brand-400 to-purple-400 bg-clip-text text-transparent">
                {s.n}
              </p>
              <p className="text-xs md:text-sm text-slate-400 mt-1 uppercase tracking-wider">
                {s.l}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── SPECIALTIES ─────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-20 lg:py-24">
        <div className="text-center mb-14">
          <div className="inline-block text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
            Our Services
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl font-bold text-slate-900">
            Comprehensive medical care
          </h2>
          <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
            Every major medical discipline under one roof — so you get seamless
            care from diagnosis to recovery.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-5">
          {SPECIALTIES.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.name}
                to="/services"
                className="group bg-white rounded-2xl border border-slate-200 p-5 lg:p-6 hover:border-brand-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-200"
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 ${s.color}`}
                >
                  <Icon size={22} />
                </div>
                <h3 className="font-semibold text-slate-900 group-hover:text-brand-700 transition-colors">
                  {s.name}
                </h3>
                <p className="text-xs text-slate-500 mt-1">{s.desc}</p>
              </Link>
            );
          })}
        </div>

        <div className="text-center mt-10">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 text-brand-600 hover:text-brand-700 font-medium text-sm"
          >
            View all services <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-20 lg:py-24">
          <div className="text-center mb-14">
            <div className="inline-block text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
              How It Works
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold text-slate-900">
              Healthcare made simple
            </h2>
            <p className="mt-3 text-slate-600 max-w-2xl mx-auto">
              From booking to recovery — four easy steps to better health.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Connector line on desktop */}
            <div className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-brand-200 via-brand-300 to-brand-200" />

            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative text-center">
                  <div className="relative inline-flex w-24 h-24 bg-white rounded-full border-2 border-brand-100 shadow-lg items-center justify-center mb-5">
                    <div className="w-20 h-20 bg-gradient-to-br from-brand-500 to-brand-700 rounded-full flex items-center justify-center text-white shadow-md">
                      <Icon size={28} />
                    </div>
                    <span className="absolute -top-1 -right-1 w-7 h-7 bg-slate-900 text-white rounded-full text-xs font-bold flex items-center justify-center border-2 border-white">
                      {i + 1}
                    </span>
                  </div>
                  <h3 className="font-semibold text-slate-900">{s.title}</h3>
                  <p className="text-sm text-slate-600 mt-2 max-w-[220px] mx-auto">
                    {s.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── WHY CHOOSE US ───────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-20 lg:py-24">
        <div className="grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <div className="inline-block text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
              Why MediCare
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold text-slate-900 leading-tight">
              Care you can trust,
              <br />
              results you can see.
            </h2>
            <p className="mt-4 text-slate-600 leading-relaxed">
              We combine state-of-the-art technology with a patient-first
              philosophy, so you receive care that's both advanced and human.
            </p>

            <div className="mt-8 space-y-5">
              {WHY_US.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="flex gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-50 flex items-center justify-center shrink-0">
                      <Icon size={20} className="text-brand-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900">
                        {f.title}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1">{f.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <Link
              to="/about"
              className="inline-flex items-center gap-2 mt-8 text-brand-600 hover:text-brand-700 font-medium text-sm"
            >
              Learn more about us <ArrowRight size={16} />
            </Link>
          </div>

          {/* Image collage */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-4">
                <div className="aspect-[4/5] bg-gradient-to-br from-brand-500 to-brand-700 rounded-2xl flex items-center justify-center text-6xl shadow-lg">
                  👨‍⚕️
                </div>
                <div className="aspect-square bg-gradient-to-br from-purple-500 to-purple-700 rounded-2xl flex items-center justify-center text-5xl shadow-lg">
                  💊
                </div>
              </div>
              <div className="space-y-4 pt-8">
                <div className="aspect-square bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-2xl flex items-center justify-center text-5xl shadow-lg">
                  🩺
                </div>
                <div className="aspect-[4/5] bg-gradient-to-br from-amber-500 to-amber-600 rounded-2xl flex items-center justify-center text-6xl shadow-lg">
                  🧪
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ────────────────────────────── */}
      <section className="bg-slate-50 border-y border-slate-100">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-20 lg:py-24">
          <div className="text-center mb-14">
            <div className="inline-block text-xs font-semibold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-full uppercase tracking-wider">
              Testimonials
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold text-slate-900">
              What our patients say
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-lg transition-shadow"
              >
                <div className="flex gap-0.5 mb-4">
                  {Array.from({ length: t.rating }).map((_, i) => (
                    <Star
                      key={i}
                      size={16}
                      className="text-amber-500 fill-amber-500"
                    />
                  ))}
                </div>
                <p className="text-slate-700 leading-relaxed">"{t.text}"</p>
                <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-3">
                  <div className="w-10 h-10 bg-brand-100 rounded-full flex items-center justify-center text-brand-700 font-semibold text-sm">
                    {t.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">
                      {t.name}
                    </p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ───────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 lg:px-8 py-20">
        <div className="relative overflow-hidden bg-gradient-to-br from-brand-600 via-brand-700 to-purple-700 text-white rounded-3xl p-10 lg:p-16 text-center shadow-2xl shadow-brand-600/30">
          {/* Decorative */}
          <div className="absolute -top-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-white/10 rounded-full blur-3xl" />

          <div className="relative">
            <div className="inline-flex items-center gap-2 bg-white/15 backdrop-blur rounded-full px-4 py-1.5 text-xs font-medium mb-6">
              <Clock size={14} /> Appointments available today
            </div>
            <h2 className="text-3xl md:text-5xl font-bold">
              Ready to feel better?
            </h2>
            <p className="mt-4 text-brand-100 max-w-xl mx-auto text-lg">
              Book an appointment with one of our specialists today. Same-day
              and next-day slots available.
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 bg-white text-brand-700 px-6 py-3 rounded-xl font-semibold hover:bg-brand-50 transition-all shadow-lg"
              >
                Book Appointment <ArrowRight size={18} />
              </Link>
              <a
                href="tel:+910000000000"
                className="inline-flex items-center gap-2 bg-white/15 backdrop-blur border border-white/30 text-white px-6 py-3 rounded-xl font-semibold hover:bg-white/25 transition-all"
              >
                <Phone size={18} /> Call Now
              </a>
            </div>

            <p className="mt-6 text-xs text-brand-200">
              No credit card required · Free cancellation up to 24h · Insurance
              accepted
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
