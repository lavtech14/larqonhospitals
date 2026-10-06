import { useParams, Link } from "react-router-dom";
import { useDoctor } from "../../hooks/useDoctors";
import { SkeletonLine } from "../../components/Skeleton";

export default function DoctorDetailPage() {
  const { id } = useParams();
  const { data, isLoading, isError } = useDoctor(id);

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
    <div className="p-6 space-y-4">
      <Link to="/doctors" className="text-blue-600 hover:underline">
        ← Back
      </Link>
      <h1 className="text-2xl font-bold">{data.user.name}</h1>
      <p className="text-slate-600">{data.specialization}</p>

      <div className="bg-white rounded-xl shadow p-6 grid grid-cols-2 gap-4 text-sm">
        <p>
          <b>Email:</b> {data.user.email}
        </p>
        <p>
          <b>Phone:</b> {data.user.phone || "-"}
        </p>
        <p>
          <b>Fees:</b> ₹{Number(data.fees).toFixed(2)}
        </p>
        <p className="col-span-2">
          <b>Bio:</b> {data.bio || "-"}
        </p>
      </div>
    </div>
  );
}
