import { useParams, Link } from "react-router-dom";
import { useLabTest } from "../../hooks/useLab";

export default function LabTestDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useLabTest(id);

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (isError) return <div className="p-6 text-red-600">Failed to load</div>;

  const isImage = data.resultUrl && !data.resultUrl.endsWith(".pdf");

  return (
    <div className="p-6 space-y-4 max-w-3xl">
      <Link to="/lab" className="text-blue-600 hover:underline">
        ← Lab Tests
      </Link>
      <h1 className="text-2xl font-bold">{data.testName}</h1>

      <div className="bg-white rounded-xl shadow p-6 grid grid-cols-2 gap-4 text-sm">
        <p>
          <b>Type:</b> {data.testType}
        </p>
        <p>
          <b>Status:</b> {data.status}
        </p>
        <p>
          <b>Patient:</b> {data.patient.name}
        </p>
        <p>
          <b>Ordered by:</b> {data.orderedBy.name}
        </p>
        {data.completedBy && (
          <p>
            <b>Completed by:</b> {data.completedBy.name}
          </p>
        )}
        {data.completedAt && (
          <p>
            <b>Completed at:</b> {new Date(data.completedAt).toLocaleString()}
          </p>
        )}
        {data.notes && (
          <p className="col-span-2">
            <b>Clinical notes:</b> {data.notes}
          </p>
        )}
        {data.resultNotes && (
          <p className="col-span-2">
            <b>Result notes:</b> {data.resultNotes}
          </p>
        )}
      </div>

      {data.resultUrl && (
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <h2 className="font-semibold">Result</h2>
          {isImage ? (
            <a href={data.resultUrl} target="_blank" rel="noreferrer">
              <img
                src={data.resultUrl}
                alt="Result"
                className="rounded max-h-96 object-contain"
              />
            </a>
          ) : (
            <a
              href={data.resultUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-block text-blue-600 hover:underline"
            >
              📄 Open result PDF
            </a>
          )}
        </div>
      )}
    </div>
  );
}
