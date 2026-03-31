import { useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "../auth/AuthContext";
import { hasPermission } from "../auth/access";
import WorkspaceLayout from "../components/WorkspaceLayout";
import { useOrders } from "../hooks/useOrders";
import { useCreateStaff, useStaff } from "../hooks/useOrganizations";
import { useRoles } from "../hooks/useRoles";
import { useWorkspaceSection } from "../hooks/useWorkspaceSection";
import { useWorkspaceSelection } from "../hooks/useWorkspaceSelection";
import { useToast } from "../hooks/useToast";
import { assignRoleRequest } from "../lib/api";

const roleOptions = [
  "admin",
  "manager",
  "worker",
  "cashier",
  "viewer",
] as const;
const STAFF_SECTIONS = ["summary", "list", "create"] as const;
type BaseRole = (typeof roleOptions)[number];

function isBaseRole(value: string): value is BaseRole {
  return roleOptions.some((role) => role === value);
}

function StaffPage() {
  const { auth } = useAuth();
  const token = auth?.accessToken ?? "";
  const canManageStaff = hasPermission(auth, "staff.manage");
  const { toast } = useToast();
  const { organizationId } = useWorkspaceSelection();
  const [search, setSearch] = useState("");
  const [staffForm, setStaffForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    primaryRole: "worker",
  });

  const { data: staff = [] } = useStaff(token, organizationId, true);
  const { data: orders = [] } = useOrders(token, organizationId);
  const { data: roles = [] } = useRoles(token, organizationId);
  const createStaff = useCreateStaff(token, organizationId);

  const enrichedStaff = useMemo(() => {
    return staff.map((member) => {
      const assignedOrders = orders.filter((order) =>
        order.tasks.some((task) => task.assignedStaff?.id === member.id),
      );
      const activeTaskCount = assignedOrders.reduce(
        (sum, order) =>
          sum +
          order.tasks.filter(
            (task) =>
              task.assignedStaff?.id === member.id &&
              ["pending", "in_progress", "waiting_parts"].includes(task.status),
          ).length,
        0,
      );

      return {
        ...member,
        assignedOrderCount: assignedOrders.length,
        activeTaskCount,
      };
    });
  }, [orders, staff]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return enrichedStaff;

    return enrichedStaff.filter((member) =>
      [
        member.fullName,
        member.primaryRole,
        member.user.email,
        member.user.phone,
        ...member.assignedRoles.map((role) => role.role.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [enrichedStaff, search]);

  const roleSummary = useMemo(() => {
    return roleOptions.map((role) => ({
      role,
      count: filteredStaff.filter((member) => member.primaryRole === role)
        .length,
    }));
  }, [filteredStaff]);
  const { activeSection } = useWorkspaceSection(
    canManageStaff ? STAFF_SECTIONS : STAFF_SECTIONS.slice(0, 2),
    "summary",
  );

  async function handleCreateStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) {
      toast("Avval firma tanlang.", "error");
      return;
    }
    if (
      !staffForm.fullName.trim() ||
      !staffForm.email.trim() ||
      !staffForm.password.trim()
    ) {
      toast("Ism, email va parolni to'ldiring.", "error");
      return;
    }

    try {
      const selectedPrimaryRole = staffForm.primaryRole;
      const hasBaseRole = isBaseRole(selectedPrimaryRole);
      const targetRoleId = hasBaseRole ? undefined : selectedPrimaryRole;
      const primaryRoleValue: BaseRole = hasBaseRole
        ? selectedPrimaryRole
        : "worker";

      const newStaff = await createStaff.mutateAsync({
        organizationId,
        fullName: staffForm.fullName,
        email: staffForm.email,
        phone: staffForm.phone || undefined,
        password: staffForm.password,
        primaryRole: primaryRoleValue,
      });

      if (targetRoleId) {
        await assignRoleRequest(token, {
          organizationId,
          staffMemberId: newStaff.id,
          roleId: targetRoleId,
        });
      }

      setStaffForm({
        fullName: "",
        email: "",
        phone: "",
        password: "",
        primaryRole: "worker",
      });
      toast("Yangi xodim qo'shildi.", "success");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Xodim qo'shilmadi.",
        "error",
      );
    }
  }

  return (
    <WorkspaceLayout>
      <div className="bot-topbar">
        <div className="bot-topbar-left">
          <div className="bot-topbar-title">Xodimlar</div>
          <div className="bot-topbar-subtitle">Jamoa, rollar va workload</div>
        </div>
      </div>

      <section className="workspace-toolbar panel">
        <label className="field">
          <span>Qidiruv</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Ism, rol, email yoki telefon"
          />
        </label>
      </section>

      {activeSection === "summary" ? (
        <section className="workspace-summary-grid" id="summary">
          {roleSummary.map((item) => (
            <article key={item.role} className="workspace-summary-card">
              <span>{item.role}</span>
              <strong>{item.count}</strong>
              <p>Tanlangan firma bo'yicha</p>
            </article>
          ))}
        </section>
      ) : activeSection === "list" ? (
        <section className="dashboard-grid">
          <article className="panel panel-wide" id="list">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Jamoa ro'yxati</p>
                <h3>Xodimlar va ularning bandligi</h3>
              </div>
            </div>

            {filteredStaff.length === 0 ? (
              <div className="workspace-empty-state">
                <strong>Xodim topilmadi</strong>
                <p>Tanlangan firma yoki qidiruv bo'yicha natija yo'q.</p>
              </div>
            ) : (
              <div className="staff-grid">
                {filteredStaff.map((member) => (
                  <article
                    key={member.id}
                    className="team-card staff-member-card"
                  >
                    <div className="staff-member-card__header">
                      <div className="team-card-head">
                        <div className="team-avatar">
                          {member.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div className="team-copy">
                          <strong>{member.fullName}</strong>
                          <span>{member.user.email}</span>
                        </div>
                      </div>
                      <div className="staff-member-card__badges">
                        <div className="team-role-badge">
                          {member.primaryRole}
                        </div>
                        <span
                          className={`status-pill ${member.isActive ? "green" : "red"}`}
                        >
                          {member.isActive ? "faol" : "nofaol"}
                        </span>
                      </div>
                    </div>

                    <div className="dashboard-chip-row staff-member-card__roles">
                      {member.assignedRoles.map((assigned) => (
                        <span key={assigned.id} className="status-pill accent">
                          {assigned.role.name}
                        </span>
                      ))}
                    </div>

                    <div className="staff-member-card__stats">
                      <div className="client-meta-chip staff-member-card__stat">
                        <span>Order</span>
                        <strong>{member.assignedOrderCount}</strong>
                      </div>
                      <div className="client-meta-chip staff-member-card__stat">
                        <span>Faol task</span>
                        <strong>{member.activeTaskCount}</strong>
                      </div>
                      <div className="client-meta-chip staff-member-card__stat">
                        <span>Telefon</span>
                        <strong className="staff-member-card__phone">
                          {member.user.phone || "Yo'q"}
                        </strong>
                      </div>
                    </div>

                    <div className="staff-member-card__footer">
                      <span className="staff-member-card__hint">
                        Xodim faoliyati va tarixini ochish
                      </span>
                      <Link
                        className="ghost-btn staff-member-card__action"
                        to={`/staff/${member.id}`}
                      >
                        Profilni ochish
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : canManageStaff ? (
        <section className="dashboard-grid">
          <article className="panel" id="create">
            <div className="panel-head">
              <div>
                <p className="eyebrow">Yangi xodim</p>
                <h3>Jamoaga qo'shish</h3>
              </div>
            </div>

            <form className="workspace-form-stack" onSubmit={handleCreateStaff}>
              <label className="field">
                <span>To'liq ism</span>
                <input
                  value={staffForm.fullName}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      fullName: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  value={staffForm.email}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      email: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label className="field">
                <span>Telefon</span>
                <input
                  value={staffForm.phone}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      phone: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="field">
                <span>Rol</span>
                <select
                  value={staffForm.primaryRole}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      primaryRole: event.target.value,
                    }))
                  }
                >
                  <optgroup label="Asosiy Rollar">
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </optgroup>
                  {roles.filter((r) => !r.isSystemRole).length > 0 && (
                    <optgroup label="Qo'shimcha Rollar">
                      {roles
                        .filter((r) => !r.isSystemRole)
                        .map((role) => (
                          <option key={role.id} value={role.id}>
                            {role.name}
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <label className="field">
                <span>Parol</span>
                <input
                  value={staffForm.password}
                  onChange={(event) =>
                    setStaffForm((current) => ({
                      ...current,
                      password: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <button className="primary-btn" disabled={createStaff.isPending}>
                {createStaff.isPending ? "Saqlanmoqda..." : "Xodim qo'shish"}
              </button>
            </form>
          </article>
        </section>
      ) : null}
    </WorkspaceLayout>
  );
}

export default StaffPage;
