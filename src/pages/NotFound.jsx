import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6">
      <p className="text-6xl mb-4">🔍</p>
      <h1 className="text-2xl font-bold mb-2">Page not found</h1>
      <p className="text-slate-600 mb-6">
        The page you're looking for doesn't exist.
      </p>
      <Link
        to="/dashboard"
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Go to Dashboard
      </Link>
    </div>
  );
}
