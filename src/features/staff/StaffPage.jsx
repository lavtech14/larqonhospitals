import { useState } from "react";
import {
  UserPlus,
  Search,
  Shield,
  UserCog,
  FlaskConical,
  Pill,
  Mail,
  Phone,
  CheckCircle2,
  XCircle,
  Power,
} from "lucide-react";
import {
  useUsers,
  useCreateStaff,
  useToggleUserActive,
} from "../../hooks/useUsers";
import { showSuccess, showError } from "../../utils/toast";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import Badge from "../../components/ui/Badge";
import Avatar from "../../components/ui/Avatar";
import EmptyState from "../../components/ui/EmptyState";
import { SkeletonTable } from "../../components/Skeleton";
import StaffFormModal from "./StaffFormModal";

const ROLE_META = {
  ADMIN: { label: "Admin", icon: Shield, color: "purple" },
  RECEPTIONIST: { label: "Receptionist", icon: UserCog, color: "info" },
  LAB: { label: "Lab Tech", icon: FlaskConical, color: "warning" },
  PHARMACY: { label: "Pharmacist", icon: Pill, color: "success" },
};

// Roles this page manages (doctors excluded — they have their own page)
const MANAGED_ROLES = ["ADMIN", "RECEPTIONIST", "LAB", "PHARMACY"];

export default function StaffPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const { data, isLoading, isError } = useUsers();
  const createMut = useCreateStaff();
  const toggleMut = useToggleUserActive();

  const handleCreate = async (form) => {
    try {
      await createMut.mutateAsync(form);
      showSuccess(
        `${form.name} added as ${ROLE_META[form.role]?.label || form.role}`,
      );
      setModalOpen(false);
    } catch (e) {
      showError(e.response?.data?.message || "Failed to create staff");
      throw e;
    }
  };

  const handleToggle = async (user) => {
    if (!confirm(`${user.isActive ? "Disable" : "Enable"} ${user.name}?`))
      return;
    try {
      await toggleMut.mutateAsync(user.id);
      showSuccess(`User ${user.isActive ? "disabled" : "enabled"}`);
    } catch (e) {
      showError(e.response?.data?.message || "Failed");
    }
  };

  // Filter: only managed roles + match search/role filter
  const staff = (data?.data || [])
    .filter((u) => MANAGED_ROLES.includes(u.role))
    .filter((u) => (roleFilter ? u.role === roleFilter : true))
    .filter((u) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    });

  const counts = MANAGED_ROLES.reduce((acc, r) => {
    acc[r] = (data?.data || []).filter((u) => u.role === r).length;
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Staff Management
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Create and manage hospital staff accounts (Receptionists, Lab Techs,
            Pharmacists, Admins).
          </p>
        </div>
        <Button icon={UserPlus} onClick={() => setModalOpen(true)}>
          Add Staff
        </Button>
      </div>

      {/* Role summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {MANAGED_ROLES.map((role) => {
          const meta = ROLE_META[role];
          const Icon = meta.icon;
          return (
            <button
              key={role}
              onClick={() => setRoleFilter(roleFilter === role ? "" : role)}
              className={`text-left bg-white rounded-xl border p-4 transition-all hover:shadow-md ${
                roleFilter === role
                  ? "border-brand-400 ring-2 ring-brand-100"
                  : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <Icon size={18} className="text-slate-400" />
                <span className="text-2xl font-bold text-slate-900">
                  {counts[role]}
                </span>
              </div>
              <p className="text-sm font-medium text-slate-700 mt-2">
                {meta.label}
              </p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1">
          <Input
            icon={Search}
            placeholder="Search by name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="sm:w-56">
          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All roles</option>
            {MANAGED_ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_META[r].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {/* Table */}
      {isLoading && <SkeletonTable rows={5} cols={5} />}
      {isError && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg text-sm">
          Failed to load staff. Make sure you're logged in as an admin.
        </div>
      )}

      {!isLoading && !isError && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {staff.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title={
                search || roleFilter
                  ? "No matching staff"
                  : "No staff members yet"
              }
              subtitle={
                search || roleFilter
                  ? "Try clearing filters or searching something else."
                  : "Add your first staff member to get started."
              }
              action={
                !search &&
                !roleFilter && (
                  <Button icon={UserPlus} onClick={() => setModalOpen(true)}>
                    Add Staff
                  </Button>
                )
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Staff Member</th>
                    <th className="px-5 py-3 font-medium">Contact</th>
                    <th className="px-5 py-3 font-medium">Role</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {staff.map((u) => {
                    const meta = ROLE_META[u.role] || {};
                    const Icon = meta.icon || Shield;
                    return (
                      <tr
                        key={u.id}
                        className="hover:bg-slate-50/60 transition-colors"
                      >
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={u.name} size="md" />
                            <div className="min-w-0">
                              <p className="font-medium text-slate-900 truncate">
                                {u.name}
                              </p>
                              <p className="text-xs text-slate-500 font-mono truncate">
                                #{u.id.slice(0, 8)}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="space-y-1 text-xs text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Mail size={12} className="text-slate-400" />
                              <span className="truncate">{u.email}</span>
                            </div>
                            {u.phone && (
                              <div className="flex items-center gap-1.5">
                                <Phone size={12} className="text-slate-400" />
                                <span>{u.phone}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Badge variant={meta.color}>
                            <Icon size={12} /> {meta.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-3.5">
                          {u.isActive ? (
                            <Badge variant="success">
                              <CheckCircle2 size={12} /> Active
                            </Badge>
                          ) : (
                            <Badge variant="danger">
                              <XCircle size={12} /> Disabled
                            </Badge>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            size="sm"
                            variant={u.isActive ? "ghost" : "outline"}
                            icon={Power}
                            onClick={() => handleToggle(u)}
                            loading={toggleMut.isPending}
                          >
                            {u.isActive ? "Disable" : "Enable"}
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <StaffFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
      />
    </div>
  );
}
