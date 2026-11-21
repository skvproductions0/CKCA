import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  School,
  Plus,
  Search,
  CheckCircle,
  AlertTriangle,
  Archive,
  ArrowRight,
  Edit2,
  Trash2,
  RefreshCw,
  Upload,
  Lock,
  Sliders,
  Palette,
  MapPin,
  Phone,
  Mail,
  Award,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiCall, cn } from '../../utils/helpers';
import { SchoolRecord } from '../../types';

export default function CreatorSchoolsPage() {
  const { enterSchool } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED'>('ALL');
  const [enteringId, setEnteringId] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<SchoolRecord | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<SchoolRecord | null>(null);
  const [creatorPassword, setCreatorPassword] = useState('');
  const [suspendTarget, setSuspendTarget] = useState<SchoolRecord | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadSchools();
  }, [statusFilter]);

  const loadSchools = async () => {
    setLoading(true);
    try {
      if (window.api && window.api.creator?.schools) {
        const res = await apiCall(() =>
          window.api.creator.schools.list({
            status: statusFilter,
            search: search.trim() || undefined,
          })
        );
        setSchools(res.schools || []);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load schools');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadSchools();
  };

  const handleEnter = async (s: SchoolRecord) => {
    setEnteringId(s.id);
    try {
      await enterSchool(s.id);
      success(`Entered ${s.name} in view/manage mode!`);
      navigate('/dashboard');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to enter school');
    } finally {
      setEnteringId(null);
    }
  };

  const handleReactivate = async (s: SchoolRecord) => {
    setActionLoading(true);
    try {
      await apiCall(() => window.api.creator.schools.reactivate(s.id));
      success(`School "${s.name}" is now ACTIVE.`);
      loadSchools();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to reactivate school');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspendConfirm = async () => {
    if (!suspendTarget) return;
    setActionLoading(true);
    try {
      await apiCall(() => window.api.creator.schools.suspend(suspendTarget.id, suspendReason));
      success(`School "${suspendTarget.name}" has been SUSPENDED.`);
      setSuspendTarget(null);
      setSuspendReason('');
      loadSchools();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to suspend school');
    } finally {
      setActionLoading(false);
    }
  };

  const handleArchiveConfirm = async () => {
    if (!archiveTarget || !creatorPassword) return;
    setActionLoading(true);
    try {
      await apiCall(() => window.api.creator.schools.archive(archiveTarget.id, creatorPassword));
      success(`School "${archiveTarget.name}" has been archived.`);
      setArchiveTarget(null);
      setCreatorPassword('');
      loadSchools();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to archive school');
    } finally {
      setActionLoading(false);
    }
  };

  // Stats calculation
  const totalCount = schools.length;
  const activeCount = schools.filter((s) => s.status === 'ACTIVE').length;
  const suspendedCount = schools.filter((s) => s.status === 'SUSPENDED').length;
  const archivedCount = schools.filter((s) => s.status === 'ARCHIVED').length;

  return (
    <div className="space-y-6">
      {/* Top Bar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <School className="w-6 h-6 text-amber-500" />
            School Management
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Manage all onboarded schools, branding, operational status, and limits.
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/15 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Onboard New School</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Schools</p>
          <p className="text-2xl font-bold text-white mt-1">{totalCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" /> Active
          </p>
          <p className="text-2xl font-bold text-emerald-400 mt-1">{activeCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Suspended
          </p>
          <p className="text-2xl font-bold text-amber-400 mt-1">{suspendedCount}</p>
        </div>
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <Archive className="w-3.5 h-3.5" /> Archived
          </p>
          <p className="text-2xl font-bold text-slate-400 mt-1">{archivedCount}</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 rounded-xl bg-slate-900 border border-slate-800">
        {/* Status Pills */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
          {(['ALL', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const).map((st) => (
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

        {/* Search Input */}
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 flex-1 max-w-md">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, school code, city, principal..."
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
              loadSchools();
            }}
            title="Refresh"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </form>
      </div>

      {/* Schools List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
          <p className="text-sm">Loading schools catalog...</p>
        </div>
      ) : schools.length === 0 ? (
        <div className="p-12 text-center rounded-xl bg-slate-900 border border-slate-800">
          <School className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No schools found</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
            {search || statusFilter !== 'ALL'
              ? 'Try modifying your search query or status filter.'
              : 'Get started by creating your first school in the system.'}
          </p>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm"
          >
            <Plus className="w-4 h-4" /> Create School
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {schools.map((school) => {
            const isSuspended = school.status === 'SUSPENDED';
            const isArchived = school.status === 'ARCHIVED';
            const isActive = school.status === 'ACTIVE';

            return (
              <div
                key={school.id}
                className={cn(
                  'rounded-xl bg-slate-900 border border-slate-800 p-5 flex flex-col justify-between transition-all hover:border-slate-700 hover:shadow-xl',
                  isSuspended && 'border-amber-900/40 bg-slate-900/90',
                  isArchived && 'border-slate-800 opacity-60'
                )}
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center font-bold text-white text-base overflow-hidden flex-shrink-0 shadow-md"
                        style={{
                          backgroundColor: school.primaryColor || '#2563eb',
                        }}
                      >
                        {school.logoPath ? (
                          <img
                            src={school.logoPath}
                            alt={school.name}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          school.shortCode?.substring(0, 3) || 'SCH'
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-base leading-snug line-clamp-1" title={school.name}>
                          {school.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-xs px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 font-semibold border border-slate-700">
                            {school.code}
                          </span>
                          {Boolean(school.board) && (
                            <span className="text-[11px] text-slate-400 font-medium">
                              • {school.board}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    <span
                      className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-bold uppercase tracking-wider',
                        isActive && 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
                        isSuspended && 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
                        isArchived && 'bg-slate-700/50 text-slate-400 border border-slate-700'
                      )}
                    >
                      {school.status}
                    </span>
                  </div>

                  {/* School info details */}
                  <div className="space-y-1.5 text-xs text-slate-300 my-4 bg-slate-950/50 p-3 rounded-lg border border-slate-800/80">
                    {Boolean(school.principalName) && (
                      <p className="flex items-center gap-2 truncate">
                        <Award className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                        <span className="text-slate-400">Principal:</span>
                        <span className="font-medium text-slate-200">{school.principalName}</span>
                      </p>
                    )}
                    {Boolean(school.city || school.state) && (
                      <p className="flex items-center gap-2 truncate">
                        <MapPin className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{[school.city, school.state].filter(Boolean).join(', ')}</span>
                      </p>
                    )}
                    {Boolean(school.phone) && (
                      <p className="flex items-center gap-2 truncate">
                        <Phone className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{school.phone}</span>
                      </p>
                    )}
                    {Boolean(school.email) && (
                      <p className="flex items-center gap-2 truncate">
                        <Mail className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                        <span>{school.email}</span>
                      </p>
                    )}
                  </div>

                  {/* Metric Chips */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs mb-4">
                    <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-800">
                      <p className="text-slate-400 text-[10px] uppercase font-semibold">Students</p>
                      <p className="font-bold text-white text-sm mt-0.5">{school.studentCount ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-800">
                      <p className="text-slate-400 text-[10px] uppercase font-semibold">Staff</p>
                      <p className="font-bold text-white text-sm mt-0.5">{school.staffCount ?? 0}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-800">
                      <p className="text-slate-400 text-[10px] uppercase font-semibold">Admins</p>
                      <p className="font-bold text-amber-400 text-sm mt-0.5">{school.superAdminCount ?? 0}</p>
                    </div>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingSchool(school)}
                      title="Edit School & Branding"
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    {isActive ? (
                      <button
                        onClick={() => setSuspendTarget(school)}
                        title="Suspend School"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-amber-950 text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <AlertTriangle className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReactivate(school)}
                        title="Reactivate School"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-emerald-950 text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                    )}

                    {school.code !== 'CKCA01' && !isArchived && (
                      <button
                        onClick={() => {
                          setArchiveTarget(school);
                          setCreatorPassword('');
                        }}
                        title="Archive School"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-950 text-red-400 hover:text-red-300 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleEnter(school)}
                    disabled={enteringId === school.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition-all shadow-sm shadow-amber-500/10"
                  >
                    {enteringId === school.id ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Entering...</span>
                      </>
                    ) : (
                      <>
                        <span>Enter Mode</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE SCHOOL MODAL */}
      {isCreateOpen && (
        <SchoolFormModal
          isOpen={isCreateOpen}
          onClose={() => setIsCreateOpen(false)}
          onSuccess={() => {
            setIsCreateOpen(false);
            loadSchools();
          }}
        />
      )}

      {/* EDIT SCHOOL MODAL */}
      {editingSchool && (
        <SchoolFormModal
          isOpen={Boolean(editingSchool)}
          initialData={editingSchool}
          onClose={() => setEditingSchool(null)}
          onSuccess={() => {
            setEditingSchool(null);
            loadSchools();
          }}
        />
      )}

      {/* SUSPEND SCHOOL MODAL */}
      {suspendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Suspend School</h3>
            <p className="text-slate-400 text-sm mt-1">
              Are you sure you want to suspend <strong className="text-white">{suspendTarget.name}</strong> ({suspendTarget.code})?
            </p>
            <p className="text-xs text-amber-300 mt-2 bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-lg">
              ⚠️ When suspended, all staff, teachers, and admins belonging to this school will be immediately blocked from signing in with a suspension notice.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">Suspension Reason (optional)</label>
              <textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="e.g. Non-payment of subscription, compliance review..."
                className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500 h-20 resize-none"
              />
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setSuspendTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleSuspendConfirm}
                disabled={actionLoading}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-sm font-bold flex items-center gap-2"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Suspension
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ARCHIVE SCHOOL MODAL (DANGEROUS ACTION - RE-ASK CREATOR PASSWORD) */}
      {archiveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border border-red-900/60 rounded-2xl p-6 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-white">Archive School</h3>
            <p className="text-slate-400 text-sm mt-1">
              You are about to archive <strong className="text-white">{archiveTarget.name}</strong> ({archiveTarget.code}).
            </p>
            <div className="text-xs text-red-300 mt-2 bg-red-500/10 border border-red-500/20 p-3 rounded-lg leading-relaxed">
              ⚠️ <strong>Security Protection:</strong> Dangerous action. This will disconnect all users and mark the school as archived.
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirm with Creator Password:
              </label>
              <div className="relative">
                <input
                  type="password"
                  placeholder="Enter your Creator password"
                  value={creatorPassword}
                  onChange={(e) => setCreatorPassword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-red-500"
                />
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                onClick={() => setArchiveTarget(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleArchiveConfirm}
                disabled={actionLoading || !creatorPassword}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-bold flex items-center gap-2 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                Authorize & Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// FORM MODAL FOR CREATE & EDIT SCHOOL
// ==========================================

interface SchoolFormModalProps {
  isOpen: boolean;
  initialData?: SchoolRecord | null;
  onClose: () => void;
  onSuccess: () => void;
}

function SchoolFormModal({ isOpen, initialData, onClose, onSuccess }: SchoolFormModalProps) {
  const { success, error: showError } = useToast();
  const isEditing = Boolean(initialData);

  const [activeTab, setActiveTab] = useState<'basic' | 'contact' | 'branding' | 'limits'>('basic');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: initialData?.name || '',
    shortCode: initialData?.shortCode || '',
    code: initialData?.code || '',
    board: initialData?.board || 'CBSE',
    affiliationNumber: initialData?.affiliationNumber || '',
    principalName: initialData?.principalName || '',
    address: initialData?.address || '',
    city: initialData?.city || '',
    state: initialData?.state || '',
    pincode: initialData?.pincode || '',
    phone: initialData?.phone || '',
    email: initialData?.email || '',
    website: initialData?.website || '',
    primaryColor: initialData?.primaryColor || '#2563eb',
    secondaryColor: initialData?.secondaryColor || '#1e40af',
    reportHeader: initialData?.reportHeader || '',
    reportFooter: initialData?.reportFooter || '',
    maxStudents: initialData?.maxStudents || 1000,
    maxStaff: initialData?.maxStaff || 100,
    licenseExpiresAt: initialData?.licenseExpiresAt ? initialData.licenseExpiresAt.split('T')[0] : '',
    maintenanceMode: Boolean(initialData?.maintenanceMode),
    maintenanceMessage: initialData?.maintenanceMessage || '',
  });

  const [assets, setAssets] = useState<{
    logo?: string;
    favicon?: string;
    signature?: string;
    stamp?: string;
  }>({
    logo: initialData?.logoPath || undefined,
    favicon: initialData?.faviconPath || undefined,
    signature: initialData?.signaturePath || undefined,
    stamp: initialData?.stampPath || undefined,
  });

  const handleAssetSelect = async (assetType: 'logo' | 'favicon' | 'signature' | 'stamp') => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return;

        // Size check: max 2MB
        if (file.size > 2 * 1024 * 1024) {
          showError(`File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds 2MB limit.`);
          return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
          const base64 = reader.result as string;
          setAssets((prev) => ({ ...prev, [assetType]: base64 }));

          // If editing an existing school, upload immediately to backend
          if (initialData?.id) {
            try {
              const res = await apiCall(() =>
                window.api.creator.schools.uploadAsset(initialData.id, assetType, base64, file.name)
              );
              success(`Uploaded ${assetType} successfully!`);
              setAssets((prev) => ({ ...prev, [assetType]: res.path }));
            } catch (err) {
              showError(err instanceof Error ? err.message : `Failed to upload ${assetType}`);
            }
          }
        };
        reader.readAsDataURL(file);
      };
      input.click();
    } catch (err) {
      showError('Failed to open file picker.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return showError('School name is required.');
    if (!formData.code.trim()) return showError('School code is required.');

    setLoading(true);
    try {
      const payload: Record<string, any> = {
        ...formData,
        code: formData.code.trim().toUpperCase(),
        shortCode: (formData.shortCode.trim() || formData.code.substring(0, 4)).toUpperCase(),
        maxStudents: Number(formData.maxStudents),
        maxStaff: Number(formData.maxStaff),
        licenseExpiresAt: formData.licenseExpiresAt ? new Date(formData.licenseExpiresAt).toISOString() : null,
      };

      if (isEditing && initialData) {
        await apiCall(() => window.api.creator.schools.update(initialData.id, payload));
        success(`School "${payload.name}" updated successfully!`);
      } else {
        const createdSchool = await apiCall(() => window.api.creator.schools.create(payload));

        // Upload any queued assets for the new school
        for (const [type, dataUrl] of Object.entries(assets)) {
          if (dataUrl && dataUrl.startsWith('data:')) {
            try {
              await window.api.creator.schools.uploadAsset(createdSchool.id, type, dataUrl, `${type}.png`);
            } catch {
              // Non-blocking asset upload
            }
          }
        }
        success(`New school "${payload.name}" onboarded with code "${payload.code}"!`);
      }
      onSuccess();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save school');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl my-8 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-400 flex items-center justify-center">
              <School className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-lg">
                {isEditing ? `Edit School: ${initialData?.name}` : 'Onboard New School'}
              </h3>
              <p className="text-xs text-slate-400">
                {isEditing ? 'Update school credentials and global branding' : 'Register a new tenant school in the system'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Tab Nav */}
        <div className="flex items-center gap-1 px-5 pt-3 bg-slate-950 border-b border-slate-800 overflow-x-auto text-xs">
          {[
            { id: 'basic', label: 'Basic Info', icon: School },
            { id: 'contact', label: 'Contact & Location', icon: MapPin },
            { id: 'branding', label: 'Branding & Theme', icon: Palette },
            { id: 'limits', label: 'Limits & Policy', icon: Sliders },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id as any)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 border-b-2 font-semibold transition-all whitespace-nowrap',
                activeTab === t.id
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'basic' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  School Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. St. Xavier's International School"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    School Code (Login Key) <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. SXIS01"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-amber-300 font-mono font-bold uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">
                    Unique uppercase code used by school staff during login.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Short Code</label>
                  <input
                    type="text"
                    placeholder="e.g. SXIS"
                    value={formData.shortCode}
                    onChange={(e) => setFormData({ ...formData, shortCode: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white font-mono uppercase placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Education Board</label>
                  <select
                    value={formData.board}
                    onChange={(e) => setFormData({ ...formData, board: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="CBSE">CBSE</option>
                    <option value="ICSE">ICSE</option>
                    <option value="State Board">State Board</option>
                    <option value="IB">IB (International Baccalaureate)</option>
                    <option value="Cambridge">Cambridge / IGCSE</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Affiliation / Reg No.</label>
                  <input
                    type="text"
                    placeholder="e.g. CBSE/AFF/2026/8940"
                    value={formData.affiliationNumber}
                    onChange={(e) => setFormData({ ...formData, affiliationNumber: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Principal Name</label>
                <input
                  type="text"
                  placeholder="e.g. Dr. Rajesh Sharma, M.Sc., Ph.D."
                  value={formData.principalName}
                  onChange={(e) => setFormData({ ...formData, principalName: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="space-y-4 animate-fade-in">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Street Address</label>
                <input
                  type="text"
                  placeholder="e.g. 45, Vidya Vihar, Sector 12"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">City</label>
                  <input
                    type="text"
                    placeholder="e.g. Jaipur"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">State</label>
                  <input
                    type="text"
                    placeholder="e.g. Rajasthan"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">PIN Code</label>
                  <input
                    type="text"
                    placeholder="e.g. 302001"
                    value={formData.pincode}
                    onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Contact Phone</label>
                  <input
                    type="text"
                    placeholder="e.g. +91 9876543210"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Official Email</label>
                  <input
                    type="email"
                    placeholder="e.g. admin@school.edu"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Website URL</label>
                <input
                  type="text"
                  placeholder="e.g. https://www.school.edu"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          )}

          {activeTab === 'branding' && (
            <div className="space-y-5 animate-fade-in">
              {/* Color Pickers */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Primary Brand Colour
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={formData.primaryColor}
                      onChange={(e) => setFormData({ ...formData, primaryColor: e.target.value })}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Secondary Brand Colour
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <input
                      type="text"
                      value={formData.secondaryColor}
                      onChange={(e) => setFormData({ ...formData, secondaryColor: e.target.value })}
                      className="flex-1 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Uploads Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { key: 'logo', label: 'School Logo', hint: 'PNG / SVG' },
                  { key: 'favicon', label: 'Favicon Icon', hint: 'PNG / ICO' },
                  { key: 'signature', label: 'Principal Sign', hint: 'Transparent PNG' },
                  { key: 'stamp', label: 'School Stamp', hint: 'Transparent PNG' },
                ].map((item) => {
                  const val = assets[item.key as keyof typeof assets];
                  return (
                    <div
                      key={item.key}
                      className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex flex-col items-center text-center justify-between gap-2"
                    >
                      <div className="w-14 h-14 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center overflow-hidden">
                        {val ? (
                          <img src={val} alt={item.label} className="w-full h-full object-contain p-1" />
                        ) : (
                          <Upload className="w-6 h-6 text-slate-600" />
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white leading-tight">{item.label}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{item.hint}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAssetSelect(item.key as any)}
                        className="w-full py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-[11px] transition-colors"
                      >
                        {val ? 'Change' : 'Upload'}
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Report Text Customization */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Report Card Header Text
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Recognized by Govt. of Rajasthan • Affiliated to CBSE Delhi"
                    value={formData.reportHeader}
                    onChange={(e) => setFormData({ ...formData, reportHeader: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Report / Fee Receipt Footer Text
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Computer generated receipt. No signature required • Keep this for tax rebate."
                    value={formData.reportFooter}
                    onChange={(e) => setFormData({ ...formData, reportFooter: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'limits' && (
            <div className="space-y-4 animate-fade-in">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Max Student Capacity</label>
                  <input
                    type="number"
                    min="10"
                    max="100000"
                    value={formData.maxStudents}
                    onChange={(e) => setFormData({ ...formData, maxStudents: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Enrollment ceiling for this school.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Max Staff Users</label>
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={formData.maxStaff}
                    onChange={(e) => setFormData({ ...formData, maxStaff: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[11px] text-slate-400 mt-1">Max user accounts allowed.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Licence Expiry Date</label>
                <input
                  type="date"
                  value={formData.licenseExpiresAt}
                  onChange={(e) => setFormData({ ...formData, licenseExpiresAt: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-sm text-white focus:outline-none focus:border-amber-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Users receive a warning 30 days before expiry and are locked out after expiry.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">Maintenance Mode</p>
                    <p className="text-xs text-slate-400">
                      Temporarily block logins for this school except Creator
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={formData.maintenanceMode}
                    onChange={(e) => setFormData({ ...formData, maintenanceMode: e.target.checked })}
                    className="w-5 h-5 rounded accent-amber-500 cursor-pointer"
                  />
                </div>

                {formData.maintenanceMode && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">Maintenance Message</label>
                    <input
                      type="text"
                      placeholder="e.g. Scheduled system upgrade in progress. Back online at 6:00 PM."
                      value={formData.maintenanceMessage}
                      onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white focus:outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Modal Footer */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-amber-500/15 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{isEditing ? 'Save Changes' : 'Onboard School'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
