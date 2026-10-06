import { useState, useRef } from "react";
import { showError } from "../../utils/toast";

const CATEGORIES = ["REPORT", "SCAN", "XRAY", "LAB", "OTHER"];

export default function AttachmentUploadModal({ open, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("REPORT");
  const [notes, setNotes] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!title) return showError("Title required");
    if (!file) return showError("Choose a file");

    setBusy(true);
    const fd = new FormData();
    fd.append("title", title);
    fd.append("category", category);
    fd.append("notes", notes);
    fd.append("file", file);

    try {
      await onSubmit(fd);
      setTitle("");
      setCategory("REPORT");
      setNotes("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <form
        onSubmit={submit}
        className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4"
      >
        <h2 className="text-xl font-bold">Upload Attachment</h2>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title (e.g. Chest X-Ray Oct 2026)"
          className="w-full border rounded px-3 py-2"
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="w-full border rounded px-3 py-2"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm"
        />

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optional)"
          className="w-full border rounded px-3 py-2"
          rows={2}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded border"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-50"
          >
            {busy ? "Uploading..." : "Upload"}
          </button>
        </div>
      </form>
    </div>
  );
}
