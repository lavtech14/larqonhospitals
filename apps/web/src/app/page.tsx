import type { Metadata } from "next";
import Link from "next/link";
import PublicHeader from "@/components/home/PublicHeader";
import HomeIcon from "@/components/home/HomeIcon";
import type { HomeIconName } from "@/components/home/HomeIcon";
import CareIllustration from "@/components/home/CareIllustration";
export const metadata: Metadata = {
  title: "Larqon Hospitals | Care, connected.",
  description:
    "Plan your visit to Larqon Hospitals and access your appointments, released lab reports, visit summaries, and issued prescriptions through the patient portal.",
};
const primary =
  "inline-flex min-h-12 items-center justify-center gap-3 rounded-full bg-[#164c42] px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#103b32] focus-visible:outline-offset-4";
const eyebrow =
  "text-[11px] font-bold uppercase tracking-[.2em] text-[#526d56]";
const care: {
  icon: HomeIconName;
  title: string;
  description: string;
  number: string;
}[] = [
  {
    icon: "heart",
    title: "Consultations, with you in mind.",
    description:
      "Meet your doctor in person, discuss your concerns, and understand the next steps in your care.",
    number: "01",
  },
  {
    icon: "flask",
    title: "Your reports, in one place.",
    description:
      "View laboratory reports in your patient account after the laboratory has reviewed and released them.",
    number: "02",
  },
  {
    icon: "pill",
    title: "A clear plan after your visit.",
    description:
      "Revisit your published visit summary and issued prescriptions, with the directions recorded by your doctor.",
    number: "03",
  },
];
const resources: {
  icon: HomeIconName;
  title: string;
  description: string;
  href: string;
}[] = [
  {
    icon: "calendar",
    title: "Your appointments",
    description: "Check your scheduled visits and consultation details.",
    href: "/patient/appointments",
  },
  {
    icon: "file",
    title: "Your visit records",
    description: "Review published summaries, vitals, and released reports.",
    href: "/patient/visits",
  },
  {
    icon: "video",
    title: "Online consultations",
    description:
      "Join an eligible online appointment from its appointment page.",
    href: "/patient/appointments",
  },
];
const questions = [
  [
    "How do I arrange an appointment?",
    "Hospital reception can help you register and arrange an appointment with an available doctor. If you already have an account, you can sign in to review the appointments arranged for you.",
  ],
  [
    "How do I get a patient account?",
    "Your patient account is created and linked to your hospital record by reception or an administrator. Ask reception for account access. Change your initial password when prompted at your first sign-in.",
  ],
  [
    "When will my lab reports appear?",
    "Reports appear in the patient portal after they have been reviewed and released by the laboratory. Draft results are not shown. Open the relevant visit to find its released reports.",
  ],
  [
    "Can I join a consultation online?",
    "If your appointment is arranged as an online consultation, open it in the patient portal. Joining is available during its allowed consultation window. You may need to allow camera and microphone access.",
  ],
  [
    "Where can I find my prescription?",
    "Issued prescriptions appear with the relevant visit in your patient portal. A prescription that is still a draft is not available to patients.",
  ],
];
export default function HospitalHomePage() {
  return (
    <div
      className="min-h-dvh bg-[#fbfcf8] text-[#243e33] selection:bg-[#cee5ce]"
      style={{ fontFamily: "var(--font-geist-sans), Arial, sans-serif" }}
    >
      <a
        href="#home-main"
        className="sr-only z-50 rounded-full bg-white px-5 py-3 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-4 focus:left-4"
      >
        Skip to content
      </a>
      <PublicHeader />
      <main id="home-main" tabIndex={-1} className="outline-none">
        <section
          aria-labelledby="hero-title"
          className="relative overflow-hidden"
        >
          <div className="mx-auto grid max-w-7xl items-center gap-8 px-5 pt-12 pb-16 sm:px-8 sm:pt-16 lg:min-h-[680px] lg:grid-cols-[1fr_1.02fr] lg:gap-8 lg:pt-12 lg:pb-20">
            <div className="relative z-10 lg:pb-7">
              <p className="mb-7 inline-flex items-center gap-2.5 rounded-full border border-[#d8e4d7] bg-[#eff5eb] px-3.5 py-2 text-[10px] font-bold uppercase tracking-[.17em] text-[#45694e]">
                <span className="size-1.5 rounded-full bg-[#5a8c59]" />
                Welcome to Larqon Hospitals
              </p>
              <h1
                id="hero-title"
                className="max-w-[630px] text-[clamp(2.8rem,5.4vw,4.75rem)] leading-[1.06] font-medium tracking-[-.055em] text-[#183f34]"
              >
                Care that feels
                <br />a little more
                <br />
                <span className="font-serif italic text-[#6b8864]">human.</span>
              </h1>
              <p className="mt-7 max-w-[430px] text-[15px] leading-7 text-[#657469] sm:text-base">
                A conversation with your doctor. A clearer next step. Your
                appointments and care records, brought together at Larqon.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-5">
                <Link href="/patient" prefetch={false} className={primary}>
                  Open patient portal
                  <HomeIcon name="arrow" className="size-4" />
                </Link>
                <a
                  href="#your-visit"
                  className="inline-flex min-h-12 items-center gap-2 text-sm font-semibold text-[#35533e]"
                >
                  Plan your visit
                  <HomeIcon name="arrow" className="size-4" />
                </a>
              </div>
              <div className="mt-9 flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-full bg-[#eaf0e3] text-[#547453]">
                  <HomeIcon name="shield" className="size-4.5" />
                </span>
                <p className="max-w-64 text-xs leading-5 text-[#6b786a]">
                  Your hospital-provided account connects you to your own care
                  records.
                </p>
              </div>
            </div>
            <div className="relative mx-auto w-full max-w-[580px] lg:translate-x-3">
              <div
                className="absolute top-5 right-0 size-20 rounded-full border border-[#d9e5d6] sm:right-3 sm:size-28"
                aria-hidden="true"
              />
              <CareIllustration />
              <div className="absolute bottom-5 left-0 flex max-w-[240px] items-center gap-3 rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_12px_35px_-15px_#51735b55] sm:bottom-12 sm:-left-3">
                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#edf4e7] text-[#5d8151]">
                  <HomeIcon name="heart" className="size-6" />
                </span>
                <div>
                  <p className="text-xs font-bold text-[#254d3b]">
                    Your care, connected.
                  </p>
                  <p className="mt-1 text-[10px] leading-4 text-[#63715c]">
                    From your first visit to what comes next.
                  </p>
                </div>
              </div>
              <p className="mt-2 text-right text-[10px] text-[#63715c]">
                A little illustration of the care journey.
              </p>
            </div>
          </div>
        </section>
        <section
          aria-label="Your hospital journey"
          className="border-y border-[#dfe7db] bg-[#f0f4ea]"
        >
          <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 sm:grid-cols-3 sm:px-8 sm:py-8">
            {[
              {
                icon: "calendar" as const,
                title: "A visit that starts with you",
                text: "Appointments arranged with reception.",
              },
              {
                icon: "file" as const,
                title: "Clarity beyond the consultation",
                text: "Published records in your patient account.",
              },
              {
                icon: "video" as const,
                title: "More ways to stay connected",
                text: "In-person and scheduled online visits.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-4 sm:justify-center"
              >
                <HomeIcon
                  name={item.icon}
                  className="size-6 shrink-0 text-[#6e8964]"
                />
                <div>
                  <p className="text-xs font-bold text-[#36513a]">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-[11px] text-[#63715c]">
                    {item.text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section
          id="care"
          aria-labelledby="care-title"
          className="mx-auto max-w-7xl scroll-mt-28 px-5 py-18 sm:px-8 lg:py-24"
        >
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className={eyebrow}>Thoughtfully connected care</p>
              <h2
                id="care-title"
                className="mt-4 max-w-xl text-3xl leading-tight font-medium tracking-[-.035em] text-[#204536] sm:text-4xl"
              >
                Every step matters.
                <br />
                <span className="font-serif italic text-[#7c8f6c]">
                  We help bring them together.
                </span>
              </h2>
            </div>
            <p className="max-w-xs text-sm leading-7 text-[#63715c]">
              From the consultation to the records you take with you, keep a
              clearer view of your care journey.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {care.map((item, i) => (
              <article
                key={item.number}
                className={`group flex flex-col rounded-[24px] border p-6 sm:p-7 ${i === 1 ? "border-[#dbe5d3] bg-[#edf3e4]" : "border-[#e3e8de] bg-white"}`}
              >
                <div className="flex items-start justify-between">
                  <span
                    className={`grid size-12 place-items-center rounded-2xl ${i === 1 ? "bg-[#dce8cf]" : "bg-[#f0f4e9]"} text-[#698359]`}
                  >
                    <HomeIcon name={item.icon} className="size-6" />
                  </span>
                  <span className="text-[10px] font-semibold text-[#63715c]">
                    / {item.number}
                  </span>
                </div>
                <h3 className="mt-9 max-w-60 text-xl leading-7 font-medium tracking-tight text-[#31513b]">
                  {item.title}
                </h3>
                <p className="mt-4 flex-1 text-[13px] leading-6 text-[#63715c]">
                  {item.description}
                </p>
                <a
                  href="#patient-portal"
                  className="mt-7 inline-flex min-h-10 items-center justify-between border-t border-[#dfe7d7] pt-4 text-xs font-semibold text-[#536d49]"
                >
                  Explore your patient portal
                  <HomeIcon
                    name="arrow"
                    className="size-4 transition-transform motion-safe:group-hover:translate-x-1"
                  />
                </a>
              </article>
            ))}
          </div>
        </section>
        <section
          id="your-visit"
          aria-labelledby="visit-title"
          className="scroll-mt-28 bg-[#174a3e] px-5 py-16 text-white sm:px-8 lg:py-20"
        >
          <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[.9fr_1.1fr]">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#afcba8]">
                Your visit, made clearer
              </p>
              <h2
                id="visit-title"
                className="mt-5 max-w-sm text-4xl leading-[1.15] font-medium tracking-[-.04em] sm:text-[44px]"
              >
                A familiar face.
                <br />A clear next step.
                <br />
                <span className="font-serif italic text-[#b6cfa5]">
                  A little peace of mind.
                </span>
              </h2>
              <p className="mt-6 max-w-sm text-sm leading-7 text-[#b2c9ba]">
                New to Larqon? Start with hospital reception. Already
                registered? Your patient account keeps your scheduled visits and
                published records close.
              </p>
              <a
                href="#patient-portal"
                className="mt-7 inline-flex min-h-11 items-center gap-3 text-sm font-semibold text-[#e0edd4]"
              >
                Find your way to the portal
                <HomeIcon name="arrow" className="size-4" />
              </a>
            </div>
            <ol className="divide-y divide-white/15">
              {[
                [
                  "01",
                  "Arrange your visit",
                  "Reception can help register your details and arrange an appointment with an available doctor.",
                ],
                [
                  "02",
                  "Meet your care team",
                  "Attend your in-person appointment, or join a scheduled online consultation through its appointment page.",
                ],
                [
                  "03",
                  "Keep your next steps close",
                  "Return to your account for published visit summaries, issued prescriptions, and released lab reports.",
                ],
              ].map(([n, title, text]) => (
                <li key={n} className="flex gap-5 py-6 first:pt-0">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#779c79]/60 text-xs text-[#c4d7b4]">
                    {n}
                  </span>
                  <div>
                    <h3 className="text-lg font-medium text-white">{title}</h3>
                    <p className="mt-3 max-w-lg text-sm leading-7 text-[#afc7b7]">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>
        <section
          id="patient-portal"
          aria-labelledby="portal-title"
          className="mx-auto grid max-w-7xl scroll-mt-28 gap-10 px-5 py-18 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:gap-20 lg:py-24"
        >
          <div className="order-2 grid gap-3 lg:order-1">
            {resources.map((item) => (
              <Link
                prefetch={false}
                key={item.title}
                href={item.href}
                className="group flex items-center gap-4 rounded-[20px] border border-[#e0e8da] bg-white p-5 transition-colors hover:bg-[#f0f5e9] sm:p-6"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-[#eef4e6] text-[#62815b]">
                  <HomeIcon name={item.icon} className="size-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-bold text-[#3b553d]">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-5 text-[#63715c]">
                    {item.description}
                  </p>
                </div>
                <HomeIcon
                  name="arrow"
                  className="size-4 shrink-0 text-[#70846a] transition-transform motion-safe:group-hover:translate-x-1"
                />
              </Link>
            ))}
          </div>
          <div className="order-1 self-center lg:order-2">
            <p className={eyebrow}>A little more connected</p>
            <h2
              id="portal-title"
              className="mt-4 text-3xl leading-tight font-medium tracking-[-.035em] text-[#284b38] sm:text-4xl"
            >
              Your care records.
              <br />
              <span className="font-serif italic text-[#7a8d68]">
                Within reach.
              </span>
            </h2>
            <p className="mt-5 max-w-md text-sm leading-7 text-[#63715c]">
              Sign in with the account provided by your hospital. Review your
              scheduled appointments and the care documents made available to
              you.
            </p>
            <Link
              href="/patient/login"
              prefetch={false}
              className={`${primary} mt-7`}
            >
              Patient sign in
              <HomeIcon name="arrow" className="size-4" />
            </Link>
            <p className="mt-4 text-xs leading-6 text-[#63715c]">
              Need an account? Ask hospital reception to help you get started.
            </p>
          </div>
        </section>
        <section
          id="questions"
          aria-labelledby="questions-title"
          className="scroll-mt-28 border-y border-[#e2e8dc] bg-[#f3f5ed] px-5 py-16 sm:px-8 lg:py-20"
        >
          <div className="mx-auto grid max-w-7xl gap-9 lg:grid-cols-[.8fr_1.2fr]">
            <div>
              <p className={eyebrow}>A few helpful answers</p>
              <h2
                id="questions-title"
                className="mt-4 text-3xl font-medium tracking-[-.035em] text-[#2d4e38] sm:text-4xl"
              >
                Before your visit.
              </h2>
              <p className="mt-4 max-w-xs text-sm leading-7 text-[#63715c]">
                A little guidance to help you get started. For help with your
                appointment or account, speak with reception.
              </p>
            </div>
            <div>
              {questions.map(([q, a]) => (
                <details
                  className="group border-b border-[#dce4d4] first:border-t"
                  key={q}
                >
                  <summary className="flex min-h-17 cursor-pointer list-none items-center justify-between gap-5 py-5 text-sm font-semibold text-[#3b563f] [&::-webkit-details-marker]:hidden">
                    {q}
                    <HomeIcon
                      name="plus"
                      className="size-4 shrink-0 text-[#809174] transition-transform group-open:rotate-45"
                    />
                  </summary>
                  <p className="max-w-2xl pb-6 pr-7 text-[13px] leading-7 text-[#63715c]">
                    {a}
                  </p>
                </details>
              ))}
            </div>
          </div>
        </section>
        <section
          aria-label="Patient portal access"
          className="mx-auto max-w-7xl px-5 py-16 sm:px-8"
        >
          <div className="flex flex-wrap items-center justify-between gap-8 rounded-[28px] border border-[#e1e8d7] bg-[#ebf1e2] p-7 sm:p-10">
            <div>
              <p className={eyebrow}>Here for your next step</p>
              <h2 className="mt-3 text-2xl font-medium tracking-tight text-[#35523b] sm:text-3xl">
                A simpler way to stay close to your care.
              </h2>
              <p className="mt-3 text-sm leading-6 text-[#63715c]">
                Your appointments and published records begin with your patient
                account.
              </p>
            </div>
            <Link href="/patient" prefetch={false} className={primary}>
              Open patient portal
              <HomeIcon name="arrow" className="size-4" />
            </Link>
          </div>
        </section>
      </main>
      <footer className="border-t border-[#e2e8dc] px-5 pt-10 pb-6 sm:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-8 pb-9 sm:grid-cols-[1.5fr_1fr_1fr]">
            <div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-[#3b573f]"
              >
                <HomeIcon name="plus" className="size-5" />
                Larqon Hospitals
              </Link>
              <p className="mt-4 max-w-xs text-xs leading-6 text-[#63715c]">
                Care, connected. A clearer path from your first appointment to
                what comes next.
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#53674b]">Explore</p>
              <div className="mt-4 grid gap-3 text-xs text-[#63715c]">
                <a href="#care">Our care</a>
                <a href="#your-visit">Plan your visit</a>
                <a href="#questions">Frequently asked questions</a>
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-[#53674b]">Your account</p>
              <div className="mt-4 grid gap-3 text-xs text-[#63715c]">
                <Link prefetch={false} href="/patient/login">
                  Patient sign in
                </Link>
                <Link prefetch={false} href="/login">
                  Staff sign in
                </Link>
                <p>Account help: hospital reception</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-3 border-t border-[#e2e8dc] pt-5 text-[10px] leading-5 text-[#63715c]">
            <p>© Larqon Hospitals.</p>
            <p>This portal does not provide emergency assistance.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
