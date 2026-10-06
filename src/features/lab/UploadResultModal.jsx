import { useState, useRef } from "react";
import { showError } from "../../utils/toast";

export default function UploadResultModal({ open, onClose, onSubmit, test }) {
  const [resultNotes, setResultNotes] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef();

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (!file) return showError("Choose a result file (PDF or image)");

    setBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("resultNotes", resultNotes);

    try {
      await onSubmit(fd);
      setResultNotes("");
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
        <h2 className="text-xl font-bold">Upload Result</h2>
        <p className="text-sm text-slate-600">
          <b>Test:</b> {test?.testName} · <b>Patient:</b> {test?.patient.name}
        </p>

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm"
        />

        <textarea
          value={resultNotes}
          onChange={(e) => setResultNotes(e.target.value)}
          placeholder="Result summary / findings (optional)"
          className="w-full border rounded px-3 py-2"
          rows={3}
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
            {busy ? "Uploading..." : "Mark Completed"}
          </button>
        </div>
      </form>
    </div>
  );
}
