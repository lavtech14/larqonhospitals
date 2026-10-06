import { useState } from "react";

import { Plus, Search, Pill, PackagePlus, Pencil, Trash2 } from "lucide-react";
import {
  useMedicines,
  useCreateMedicine,
  useUpdateMedicine,
  useDeleteMedicine,
  useAddBatch,
} from "../../hooks/usePharmacy";
import { useAuth } from "../../hooks/useAuth";
import { showSuccess, showError } from "../../utils/toast";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Badge from "../../components/ui/Badge";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonTable } from "../../components/Skeleton";
import MedicineFormModal from "./MedicineFormModal";
import AddStockModal from "./AddStockModal";

export default function MedicinesPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [lowStock, setLowStock] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [stockFor, setStockFor] = useState(null);

  const { data, isLoading, isError } = useMedicines({
    page,
    limit: 20,
    search,
    category,
    lowStock: lowStock ? "true" : undefined,
  });

  const createMut = useCreateMedicine();
  const updateMut = useUpdateMedicine();
  const deleteMut = useDeleteMedicine();
  const stockMut = useAddBatch();

  const canWrite = ["ADMIN", "PHARMACY"].includes(user?.role);
  const canDelete = user?.role === "ADMIN";

  const handleSubmit = async (form) => {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, payload: form });
        showSuccess("Medicine updated");
      } else {
        await createMut.mutateAsync(form);
        showSuccess("Medicine added");
      }
      setFormOpen(false);
      setEditing(null);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  const handleAddStock = async (form) => {
    try {
      await stockMut.mutateAsync({ medicineId: stockFor.id, payload: form });
      showSuccess("Stock added");
      setStockFor(null);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Deactivate ${name}?`)) return;
    try {
      await deleteMut.mutateAsync(id);
      showSuccess("Medicine deactivated");
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Medicines</h1>
        {canWrite && (
          <Button
            icon={Plus}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            Add Medicine
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon={Search}
            placeholder="Search by brand, generic, or manufacturer..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </div>
        <div className="md:w-48">
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All categories</option>
            {[
              "TABLET",
              "CAPSULE",
              "SYRUP",
              "INJECTION",
              "OINTMENT",
              "DROPS",
              "INHALER",
              "OTHER",
            ].map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <button
          onClick={() => setLowStock((v) => !v)}
          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            lowStock
              ? "bg-amber-50 border-amber-300 text-amber-700"
              : "bg-white border-slate-300 text-slate-700 hover:bg-slate-50"
          }`}
        >
          Low stock only
        </button>
      </div>

      {isLoading && <SkeletonTable rows={8} cols={6} />}
      {isError && <p className="text-red-600">Failed to load</p>}

      {data && (
        <>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-medium">Medicine</th>
                  <th className="px-5 py-3 font-medium">Category</th>
                  <th className="px-5 py-3 font-medium">Price</th>
                  <th className="px-5 py-3 font-medium">Stock</th>
                  <th className="px-5 py-3 font-medium">Batches</th>
                  {canWrite && (
                    <th className="px-5 py-3 font-medium text-right">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.data.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/60">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-slate-900">{m.name}</div>
                      {m.genericName && (
                        <div className="text-xs text-slate-500">
                          {m.genericName}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge variant="default">{m.category}</Badge>
                    </td>
                    <td className="px-5 py-3.5 font-medium">
                      ₹{Number(m.price).toFixed(2)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`font-bold ${m.isLowStock ? "text-amber-600" : "text-slate-900"}`}
                        >
                          {m.totalStock}
                        </span>
                        {m.isLowStock && (
                          <Badge variant="warning" size="sm">
                            Low
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-slate-500">
                      {m.batches.length}
                    </td>
                    {canWrite && (
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={PackagePlus}
                            onClick={() => setStockFor(m)}
                          >
                            Stock
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Pencil}
                            onClick={() => {
                              setEditing(m);
                              setFormOpen(true);
                            }}
                          ></Button>
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              icon={Trash2}
                              onClick={() => handleDelete(m.id, m.name)}
                              className="text-red-600 hover:bg-red-50"
                            ></Button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
                {data.data.length === 0 && (
                  <tr>
                    <td colSpan={6}>
                      <EmptyState
                        icon={Pill}
                        title="No medicines found"
                        subtitle={
                          search || category || lowStock
                            ? "Try different filters."
                            : "Add your first medicine."
                        }
                      />
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-600">
              Page {data.pagination.page} of {data.pagination.totalPages} ·{" "}
              {data.pagination.total} total
            </p>
            <div className="space-x-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Prev
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={page >= data.pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        </>
      )}

      <MedicineFormModal
        open={formOpen}
        onClose={() => {
          setFormOpen(false);
          setEditing(null);
        }}
        onSubmit={handleSubmit}
        initial={editing}
      />
      <AddStockModal
        open={!!stockFor}
        onClose={() => setStockFor(null)}
        onSubmit={handleAddStock}
        medicine={stockFor}
      />
    </div>
  );
}
