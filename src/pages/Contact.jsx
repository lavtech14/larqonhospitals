import { useState } from "react";
import { showSuccess, showError } from "../utils/toast";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [busy, setBusy] = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      return showError("Please fill in all fields");
    }
    setBusy(true);
    // Demo: no backend, just show success
    setTimeout(() => {
      showSuccess("Message sent! We'll get back to you soon.");
      setForm({ name: "", email: "", message: "" });
      setBusy(false);
    }, 600);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-16 grid lg:grid-cols-2 gap-12">
      <div>
        <h1 className="text-4xl font-bold text-slate-900">Get in Touch</h1>
        <p className="mt-4 text-slate-600">
          Have a question or need to schedule a visit? We're here 24/7.
        </p>

        <div className="mt-10 space-y-6">
          {[
            {
              i: "📍",
              t: "Address",
              d: "123 Health Street, Medical City, 400001",
            },
            { i: "📞", t: "Phone", d: "+91 00000 00000" },
            { i: "✉️", t: "Email", d: "hello@Larqon Hospitals.test" },
            { i: "🕐", t: "Hours", d: "Open 24 hours, 7 days a week" },
          ].map((c) => (
            <div key={c.t} className="flex items-start gap-4">
              <span className="text-2xl">{c.i}</span>
              <div>
                <p className="font-semibold text-slate-900">{c.t}</p>
                <p className="text-sm text-slate-600">{c.d}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <form
        onSubmit={submit}
        className="bg-white rounded-2xl border p-8 shadow-sm space-y-4 h-fit"
      >
        <h2 className="text-xl font-bold text-slate-900">Send us a message</h2>

        <input
          type="text"
          placeholder="Your name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          className="w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="email"
          placeholder="Your email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <textarea
          placeholder="Your message"
          rows={5}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full border rounded-lg px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <button
          type="submit"
          disabled={busy}
          className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Sending..." : "Send Message"}
        </button>
      </form>
    </div>
  );
}
