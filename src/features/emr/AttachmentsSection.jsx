import { useAuth } from "../../hooks/useAuth";
import { useDeleteAttachment } from "../../hooks/useEMR";
import { showSuccess, showError } from "../../utils/toast";

export default function AttachmentsSection({ patientId, attachments }) {
  const { user } = useAuth();
  const deleteMut = useDeleteAttachment(patientId);

  const isAdmin = user?.role === "ADMIN";

  const handleDelete = async (id) => {
    if (!confirm("Delete this attachment?")) return;
    try {
      await deleteMut.mutateAsync(id);
      showSuccess("Deleted");
    } catch (e) {
      showError(e.response?.data?.message || "Delete failed");
    }
  };

  if (!attachments?.length)
    return <p className="text-sm text-slate-500">No attachments yet.</p>;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {attachments.map((a) => {
        const isImage = a.fileType.startsWith("image/");
        return (
          <div key={a.id} className="bg-white rounded-xl shadow p-4 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-xs text-slate-500">
                  {a.category} · {new Date(a.createdAt).toLocaleDateString()} ·
                  by {a.uploader.name}
                </p>
              </div>
              {isAdmin && (
                <button
                  onClick={() => handleDelete(a.id)}
                  className="text-red-600 text-sm hover:underline"
                >
                  Delete
                </button>
              )}
            </div>

            {isImage ? (
              <a href={a.fileUrl} target="_blank" rel="noreferrer">
                <img
                  src={a.fileUrl}
                  alt={a.title}
                  className="rounded max-h-48 object-cover w-full"
                />
              </a>
            ) : (
              <a
                href={a.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-blue-600 hover:underline text-sm"
              >
                📄 Open PDF
              </a>
            )}

            {a.notes && <p className="text-xs text-slate-600">{a.notes}</p>}
          </div>
        );
      })}
    </div>
  );
}
