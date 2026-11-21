import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Plus,
  Search,
  Lock,
  Unlock,
  KeyRound,
  LogOut,
  ArrowRightLeft,
  History,
  CheckCircle,
  School,
  Mail,
  Clock,
  RefreshCw,
  X,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiCall, cn, formatDateTime } from '../../utils/helpers';
import { SuperAdminRecord, SchoolRecord } from '../../types';

export default function CreatorSuperAdminsPage() {
  const { success, error: showError } = useToast();

  const [superAdmins, setSuperAdmins] = useState<SuperAdminRecord[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'LOCKED'>('ALL');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<SuperAdminRecord | null>(null);
  const [lockTarget, setLockTarget] = useState<SuperAdminRecord | null>(null);
  const [reassignTarget, setReassignTarget] = useState<SuperAdminRecord | null>(null);
  const [activityTarget, setActivityTarget] = useState<SuperAdminRecord | null>(null);
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [activityLoading, setActivityLoading] = useState(false);

  useEffect(() => {
    loadSchools();
    loadSuperAdmins();
  }, [selectedSchoolId, statusFilter]);

  const loadSchools = async () => {
    try {
      if (window.api && window.api.creator?.schools) {
        const res = await apiCall(() => window.api.creator.schools.list({ limit: 100 }));
        setSchools(res.schools || []);
      }
    } catch {
      // non-blocking
    }
  };

  const loadSuperAdmins = async () => {
    setLoading(true);
    try {
      if (window.api && window.api.creator?.superAdmins) {
        const res = await apiCall(() =>
          window.api.creator.superAdmins.list({
            schoolId: selectedSchoolId !== 'ALL' ? selectedSchoolId : undefined,
            status: statusFilter,
            search: search.trim() || undefined,
          })
        );
        setSuperAdmins(res.superAdmins || []);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load Super Admins');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSuperAdmins();
  };

  const handleForceLogout = async (admin: SuperAdminRecord) => {
    try {
      const res = await apiCall(() => window.api.creator.superAdmins.forceLogout(admin.id));
      success(`Forced logout for ${admin.username}. Terminated ${res.terminatedSessions} session(s).`);
      loadSuperAdmins();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to force logout');
    }
  };

  const handleViewActivity = async (admin: SuperAdminRecord) => {
    setActivityTarget(admin);
    setActivityLoading(true);
    try {
      const res = await apiCall(() => window.api.creator.superAdmins.activity(admin.id, 25));
      setActivityLogs(res || []);
    } catch (err) {
      showError('Failed to load activity logs.');
    } finally {
      setActivityLoading(false);
    }
  };

  // Stats calculation
  const totalCount = superAdmins.length;
  const activeCount = superAdmins.filter((a) => a.isActive && !a.isLocked).length;
  const lockedCount = superAdmins.filter((a) => a.isLocked || !a.isActive).length;
  const pendingPasswordCount = superAdmins.filter((a) => a.forcePasswordChange).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <ShieldCheck className="w-6 h-6 text-amber-500" />
            Super Admin Management
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Create, audit, reassign, lock/unlock, and reset passwords for Super Admins across all schools.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/15 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>New Super Admin</span>
        </button>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Super Admins</p>
          <p className="text-2xl font-bold text-white mt-1">{totalCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Active
          </p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" /> Locked
          </p>
          <p className="text-2xl font-bold text-red-400 mt-1">{lockedCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Force Reset Pending
          </p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{pendingPasswordCount}</p>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
        <div className="flex flex-wrap items-center gap-2">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
            {(['ALL', 'ACTIVE', 'LOCKED'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={cn(
                  'px-3 py-1.5 rounded-md font-semibold transition-all',
                  statusFilter === st
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                {st}
              </button>
            ))}
          </div>

          {/* School filter dropdown */}
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs">
            <School className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="bg-transparent text-slate-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, username, email, school..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>
          <button
            type="submit"
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
          >
            Search
          </button>
          <button
            type="button"
            onClick={() => {
              setSearch('');
              loadSuperAdmins();
            }}
            title="Refresh"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </form>
      </div>

      {/* Super Admins Grid */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm">Loading Super Admins...</p>
        </div>
      ) : superAdmins.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800">
          <ShieldCheck className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No Super Admins found</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
            {search || selectedSchoolId !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try modifying your search or filters.'
              : 'Create your first Super Admin to assign management to a school.'}
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm"
          >
            <Plus className="w-4 h-4" /> Create Super Admin
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {superAdmins.map((admin) => {
            const isLocked = admin.isLocked || !admin.isActive;
            const initials = admin.fullName
              ? admin.fullName
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .substring(0, 2)
                  .toUpperCase()
              : 'SA';

            return (
              <div
                key={admin.id}
                className={cn(
                  'rounded-xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between transition-all hover:border-slate-700 hover:shadow-xl',
                  isLocked && 'border-red-900/40 bg-slate-900/90'
                )}
              >
                <div>
                  {/* Top user row */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-600 to-indigo-800 flex items-center justify-center font-bold text-white text-sm shadow-md">
                          {initials}
                        </div>
                        <span
                          className={cn(
                            'w-3 h-3 rounded-full absolute -bottom-0.5 -right-0.5 border-2 border-slate-900',
                            isLocked ? 'bg-red-500' : 'bg-emerald-500'
                          )}
                          title={isLocked ? 'Account is locked' : 'Active'}
                        />
                      </div>

                      <div>
                        <h3 className="font-bold text-white text-base leading-snug line-clamp-1">
                          {admin.fullName}
                        </h3>
                        <p className="font-mono text-xs text-amber-400 font-semibold">
                          @{admin.username}
                        </p>
                      </div>
                    </div>

                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                        !isLocked
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-red-500/15 text-red-400 border border-red-500/30'
                      )}
                    >
                      {isLocked ? 'Locked' : 'Active'}
                    </span>
                  </div>

                  {/* School Badge & Contact */}
                  <div className="space-y-1.5 text-xs text-slate-300 my-4 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
                    <div className="flex items-center gap-2 truncate">
                      <School className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                      <span className="font-semibold text-white truncate">
                        {admin.school?.name || 'Unassigned'}
                      </span>
                      {Boolean(admin.school?.code) && (
                        <span className="font-mono text-[10px] px-1 rounded bg-slate-800 text-slate-400">
                          {admin.school?.code}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 truncate text-slate-400">
                      <Mail className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="truncate">{admin.email}</span>
                    </div>

                    <div className="flex items-center gap-2 truncate text-slate-400">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        Last login:{' '}
                        {admin.lastLoginAt ? formatDateTime(admin.lastLoginAt) : 'Never logged in'}
                      </span>
                    </div>
                  </div>

                  {/* Status Pills */}
                  <div className="flex flex-wrap gap-1.5 text-[11px] mb-4">
                    {admin.forcePasswordChange && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                        Must change password
                      </span>
                    )}
                    {admin.activeSessionsCount !== undefined && admin.activeSessionsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/15 text-blue-300 border border-blue-500/30 font-semibold">
                        {admin.activeSessionsCount} live session{admin.activeSessionsCount > 1 ? 's' : ''}
                      </span>
                    )}
                    {isLocked && admin.lockReason && (
                      <span className="px-2 py-0.5 rounded-md bg-red-500/15 text-red-300 border border-red-500/30 font-medium truncate max-w-full" title={admin.lockReason}>
                        Reason: {admin.lockReason}
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Action Toolbar */}
                <div className="pt-3 border-t border-slate-800/80 grid grid-cols-5 gap-1 text-center">
                  <button
                    onClick={() => setResetTarget(admin)}
                    title="Reset Password"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors flex items-center justify-center"
                  >
                    <KeyRound className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setLockTarget(admin)}
                    title={isLocked ? 'Unlock Super Admin' : 'Lock Super Admin'}
                    className={cn(
                      'p-2 rounded-lg transition-colors flex items-center justify-center',
                      isLocked
                        ? 'bg-slate-800 hover:bg-emerald-950 text-emerald-400 hover:text-emerald-300'
                        : 'bg-slate-800 hover:bg-red-950 text-red-400 hover:text-red-300'
                    )}
                  >
                    {isLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                  </button>

                  <button
                    onClick={() => setReassignTarget(admin)}
                    title="Reassign to another school"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-indigo-400 transition-colors flex items-center justify-center"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleForceLogout(admin)}
                    title="Force logout all devices"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-orange-400 transition-colors flex items-center justify-center"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => handleViewActivity(admin)}
                    title="View audit activity"
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-blue-400 transition-colors flex items-center justify-center"
                  >
                    <History className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE SUPER ADMIN MODAL */}
      {isCreateOpen && (
        <CreateSuperAdminModal
          isOpen={isCreateOpen}
          schools={schools}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false);
            loadSuperAdmins();
          }}
        />
      )}

      {/* RESET PASSWORD MODAL */}
      {resetTarget && (
        <ResetPasswordModal
          admin={resetTarget}
          onClose={() => setResetTarget(null)}
          onSuccess={() => {
            setResetTarget(null);
            loadSuperAdmins();
          }}
        />
      )}

      {/* LOCK / UNLOCK MODAL */}
      {lockTarget && (
        <LockToggleModal
          admin={lockTarget}
          onClose={() => setLockTarget(null)}
          onSuccess={() => {
            setLockTarget(null);
            loadSuperAdmins();
          }}
        />
      )}

      {/* REASSIGN SCHOOL MODAL */}
      {reassignTarget && (
        <ReassignSchoolModal
          admin={reassignTarget}
          schools={schools}
          onClose={() => setReassignTarget(null)}
          onSuccess={() => {
            setReassignTarget(null);
            loadSuperAdmins();
          }}
        />
      )}

      {/* ACTIVITY LOG DRAWER / MODAL */}
      {activityTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">
                    Activity Log: {activityTarget.fullName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    @{activityTarget.username} • {activityTarget.school?.name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActivityTarget(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {activityLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                </div>
              ) : activityLogs.length === 0 ? (
                <p className="py-10 text-center text-xs text-slate-500">
                  No recent activity logged for this user.
                </p>
              ) : (
                activityLogs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs flex items-start justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-amber-400 font-bold">{log.action}</span>
                        {Boolean(log.entity) && (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px]">
                            {log.entity}
                          </span>
                        )}
                      </div>
                      {Boolean(log.details) && (
                        <p className="text-slate-300 mt-1 leading-relaxed">{log.details}</p>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-800 mt-4 text-right">
              <button
                onClick={() => setActivityTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// SUB-MODALS
// ==========================================

function CreateSuperAdminModal({
  isOpen,
  schools,
  onClose,
  onSuccess,
}: {
  isOpen: boolean;
  schools: SchoolRecord[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { success, error: showError } = useToast();
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    schoolId: schools[0]?.id || '',
    fullName: '',
    username: '',
    email: '',
    password: '',
    forcePasswordChange: true,
  });

  const handleGeneratePassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pw = '';
    for (let i = 0; i < 12; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setForm((prev) => ({ ...prev, password: pw }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.schoolId) return showError('Please select a school.');
    if (!form.fullName.trim()) return showError('Full name is required.');
    if (!form.username.trim()) return showError('Username is required.');
    if (!form.email.trim()) return showError('Email is required.');
    if (!form.password || form.password.length < 6) return showError('Password must be at least 6 characters.');

    setLoading(true);
    try {
      await apiCall(() => window.api.creator.superAdmins.create(form));
      success(`Super Admin @${form.username} created successfully!`);
      onSuccess();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create Super Admin');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Create Super Admin</h3>
              <p className="text-xs text-slate-400">Assign top-level administrator credentials to a school</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block font-semibold text-slate-300 mb-1">Target School *</label>
            <select
              value={form.schoolId}
              onChange={(e) => setForm({ ...form, schoolId: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Username *</label>
              <input
                type="text"
                required
                placeholder="e.g. admin_ramesh"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().trim() })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-amber-300 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Email *</label>
              <input
                type="email"
                required
                placeholder="e.g. ramesh@school.edu"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value.trim() })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300">Initial Password *</label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Generate Password
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="At least 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <input
              type="checkbox"
              id="forcePwChange"
              checked={form.forcePasswordChange}
              onChange={(e) => setForm({ ...form, forcePasswordChange: e.target.checked })}
              className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
            />
            <label htmlFor="forcePwChange" className="text-slate-300 cursor-pointer select-none">
              Force password change on first login (Recommended)
            </label>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2 shadow-lg shadow-amber-500/15"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Create Administrator
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ResetPasswordModal({
  admin,
  onClose,
  onSuccess,
}: {
  admin: SuperAdminRecord;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { success, error: showError } = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [forceChange, setForceChange] = useState(true);
  const [loading, setLoading] = useState(false);

  const handleGenerate = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let pw = '';
    for (let i = 0; i < 12; i++) {
      pw += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(pw);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      return showError('Password must be at least 6 characters.');
    }
    setLoading(true);
    try {
      await apiCall(() =>
        window.api.creator.superAdmins.resetPassword(admin.id, newPassword, forceChange)
      );
      success(`Password reset for ${admin.username}. All current sessions terminated.`);
      onSuccess();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
          <KeyRound className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-white">Reset Super Admin Password</h3>
        <p className="text-slate-400 text-sm mt-1">
          Set a new password for <strong className="text-white">{admin.fullName}</strong> (@{admin.username}).
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-300">New Password</label>
              <button
                type="button"
                onClick={handleGenerate}
                className="text-amber-400 hover:text-amber-300 text-[11px] font-semibold flex items-center gap-1"
              >
                <Sparkles className="w-3 h-3" /> Generate
              </button>
            </div>
            <input
              type="text"
              required
              placeholder="Enter new password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center gap-2 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <input
              type="checkbox"
              id="forcePwReset"
              checked={forceChange}
              onChange={(e) => setForceChange(e.target.checked)}
              className="w-4 h-4 rounded accent-amber-500 cursor-pointer"
            />
            <label htmlFor="forcePwReset" className="text-slate-300 cursor-pointer select-none">
              Force user to change this password on next login
            </label>
          </div>

          <p className="text-[11px] text-slate-400 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
            ℹ️ Resetting the password will instantly terminate all active login sessions for this administrator.
          </p>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center gap-2"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              Set New Password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function LockToggleModal({
  admin,
  onClose,
  onSuccess,
}: {
  admin: SuperAdminRecord;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { success, error: showError } = useToast();
  const isLocked = admin.isLocked || !admin.isActive;
  const [reason, setReason] = useState(admin.lockReason || '');
  const [loading, setLoading] = useState(false);

  const handleToggle = async () => {
    setLoading(true);
    try {
      await apiCall(() =>
        window.api.creator.superAdmins.toggleLock(admin.id, !isLocked, reason || undefined)
      );
      success(`Super Admin @${admin.username} is now ${!isLocked ? 'LOCKED' : 'UNLOCKED'}.`);
      onSuccess();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update lock status');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
        <div
          className={cn(
            'w-12 h-12 rounded-2xl flex items-center justify-center mb-4 border',
            isLocked
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/20 text-red-400 border-red-500/30'
          )}
        >
          {isLocked ? <Unlock className="w-6 h-6" /> : <Lock className="w-6 h-6" />}
        </div>
        <h3 className="text-xl font-bold text-white">
          {isLocked ? 'Unlock Super Admin' : 'Lock Super Admin Account'}
        </h3>
        <p className="text-slate-400 text-sm mt-1">
          {isLocked ? (
            <>
              Reactivate access for <strong className="text-white">{admin.fullName}</strong> (@{admin.username}).
            </>
          ) : (
            <>
              Prevent <strong className="text-white">{admin.fullName}</strong> (@{admin.username}) from logging in.
            </>
          )}
        </p>

        {!isLocked && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Lock Reason (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Account suspended pending audit review"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-red-500"
            />
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleToggle}
            disabled={loading}
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-bold flex items-center gap-2',
              isLocked
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                : 'bg-red-600 hover:bg-red-500 text-white'
            )}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isLocked ? 'Unlock Administrator' : 'Confirm Lockout'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ReassignSchoolModal({
  admin,
  schools,
  onClose,
  onSuccess,
}: {
  admin: SuperAdminRecord;
  schools: SchoolRecord[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { success, error: showError } = useToast();
  const [targetSchoolId, setTargetSchoolId] = useState(admin.schoolId || schools[0]?.id || '');
  const [loading, setLoading] = useState(false);

  const handleReassign = async () => {
    if (!targetSchoolId) return showError('Please choose a target school.');
    setLoading(true);
    try {
      const updated = await apiCall(() =>
        window.api.creator.superAdmins.reassignSchool(admin.id, targetSchoolId)
      );
      success(`Reassigned @${admin.username} to ${updated.school?.name}.`);
      onSuccess();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to reassign school');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6">
        <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mb-4">
          <ArrowRightLeft className="w-6 h-6" />
        </div>
        <h3 className="text-xl font-bold text-white">Reassign Super Admin School</h3>
        <p className="text-slate-400 text-sm mt-1">
          Transfer <strong className="text-white">{admin.fullName}</strong> (@{admin.username}) to a different school tenant.
        </p>

        <div className="mt-4">
          <label className="block text-xs font-semibold text-slate-300 mb-1">New Assigned School</label>
          <select
            value={targetSchoolId}
            onChange={(e) => setTargetSchoolId(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-indigo-500"
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code})
              </option>
            ))}
          </select>
        </div>

        <p className="mt-3 text-xs text-slate-400 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
          ℹ️ All existing login sessions will be terminated. On their next sign in with the new school's code, this Super Admin will access the newly assigned school's data.
        </p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={handleReassign}
            disabled={loading}
            className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-bold flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Confirm Reassignment
          </button>
        </div>
      </div>
    </div>
  );
}
