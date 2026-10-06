import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchPatient } from "../../api/patients";
import { SkeletonLine } from "../../components/Skeleton";

export default function PatientDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["patient", id],
    queryFn: () => fetchPatient(id),
  });

  if (isLoading)
    return (
      <div className="p-6 space-y-3">
        <SkeletonLine className="w-40" />
        <SkeletonLine className="w-64 h-7" />
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <SkeletonLine className="w-1/2" />
          <SkeletonLine className="w-1/3" />
          <SkeletonLine className="w-2/3" />
        </div>
      </div>
    );
  if (isError) return <div className="p-6 text-red-600">Failed to load</div>;

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <Link
          to={`/patients/${data.id}/emr`}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          View EMR →
        </Link>
      </div>
      <div className="p-6 space-y-4">
        <Link to="/patients" className="text-blue-600 hover:underline">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">{data.name}</h1>
        <div className="bg-white rounded-xl shadow p-6 grid grid-cols-2 gap-4 text-sm">
          <p>
            <b>DOB:</b> {new Date(data.dob).toLocaleDateString()}
          </p>
          <p>
            <b>Gender:</b> {data.gender}
          </p>
          <p>
            <b>Blood:</b> {data.bloodGroup || "-"}
          </p>
          <p>
            <b>Phone:</b> {data.phone}
          </p>
          <p className="col-span-2">
            <b>Address:</b> {data.address || "-"}
          </p>
        </div>
      </div>
    </>
  );
}
