import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  School,
  Users,
  GraduationCap,
  ArrowRight,
  History,
  Activity,
  Layers,
  Sparkles,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { apiCall, formatDateTime } from '../../utils/helpers';

interface SchoolItem {
  id: string;
  name: string;
  code: string;
  status: string;
  plan?: string;
  studentCount?: number;
  staffCount?: number;
}

interface ExpiringSchool {
  id: string;
  name: string;
  code: string;
  status: string;
  plan: string;
  licenseExpiresAt: string;
  daysRemaining: number;
  isExpired: boolean;
}

interface EnhancedStats {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  archivedSchools: number;
  totalUsers: number;
  totalStudents: number;
  activeSessionsCount: number;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  schools: SchoolItem[];
  expiringSchools: ExpiringSchool[];
  recentActivity: Array<{
    id: string;
    action: string;
    details?: string;
    createdAt: string;
    schoolName: string;
    schoolCode: string;
    username: string;
    fullName: string;
    role: string;
  }>;
}

export default function CreatorDashboardPage() {
  const { enterSchool, user } = useAuth();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [stats, setStats] = useState<EnhancedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [enteringSchoolId, setEnteringSchoolId] = useState<string | null>(null);

  useEffect(() => {
    loadCreatorData();
  }, []);

  const loadCreatorData = async () => {
    setLoading(true);
    try {
      if (window.api?.creator?.enhancedStats) {
        const data = await apiCall(() => window.api.creator.enhancedStats());
        setStats(data as EnhancedStats);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load creator dashboard statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleEnterSchool = async (school: SchoolItem) => {
    setEnteringSchoolId(school.id);
    try {
      await enterSchool(school.id);
      success(`Entered ${school.name} in view/manage mode!`);
      navigate('/dashboard');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to enter school');
    } finally {
      setEnteringSchoolId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-slate-400 gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-sm font-medium">Loading Creator dashboard metrics...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Maintenance Mode Banner (if active) */}
      {stats?.maintenanceMode && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between text-rose-300">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-rose-400 flex-shrink-0 animate-pulse" />
            <div>
              <span className="font-bold text-white">System Maintenance Mode is LIVE</span>
              <p className="text-xs text-rose-200 mt-0.5">
                All non-Creator user logins are currently blocked. Notice: "{stats.maintenanceMessage}"
              </p>
            </div>
          </div>
          <button
            onClick={() => navigate('/creator/settings')}
            className="px-3 py-1.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors whitespace-nowrap"
          >
            Configure
          </button>
        </div>
      )}

      {/* Welcome Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 relative overflow-hidden shadow-xl">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-amber-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              Creator Level Control Centre
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              Welcome, {user?.fullName || 'System Creator'}
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl leading-relaxed">
              Developer and Owner Command Layer controlling multi-school tenants, super admins, live user sessions, feature modules, and disaster recovery.
            </p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => navigate('/creator/schools')}
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors border border-slate-700 flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Add School
            </button>
            {stats?.schools[0] && (
              <button
                onClick={() => handleEnterSchool(stats.schools[0])}
                className="px-4 py-2 rounded-lg font-bold text-xs bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all hover:scale-105"
              >
                <span>Enter {stats.schools[0].name}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* High-Level Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Schools */}
        <div className="p-5 rounded-xl bg-[#0f172a] border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Schools</span>
            <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <School className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2">{stats?.totalSchools ?? 0}</p>
          <div className="flex items-center gap-2 mt-1 text-xs">
            <span className="text-emerald-400 font-semibold">{stats?.activeSchools ?? 0} Active</span>
            <span className="text-slate-600">•</span>
            <span className="text-rose-400 font-semibold">{stats?.suspendedSchools ?? 0} Suspended</span>
          </div>
        </div>

        {/* Total Students */}
        <div className="p-5 rounded-xl bg-[#0f172a] border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Students</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <GraduationCap className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2">{stats?.totalStudents ?? 0}</p>
          <p className="text-xs text-slate-400 mt-1">Enrolled across all tenants</p>
        </div>

        {/* Staff / Users */}
        <div className="p-5 rounded-xl bg-[#0f172a] border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Staff Users</span>
            <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white mt-2">{stats?.totalUsers ?? 0}</p>
          <p className="text-xs text-purple-300 mt-1">Super Admins & Staff</p>
        </div>

        {/* Live Active Sessions */}
        <div className="p-5 rounded-xl bg-[#0f172a] border border-slate-800 shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Online Active Sessions</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Activity className="w-5 h-5" />
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl font-extrabold text-amber-400">{stats?.activeSessionsCount ?? 0}</p>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" /> Live
            </span>
          </div>
          <button
            onClick={() => navigate('/creator/active-users')}
            className="text-xs text-slate-400 hover:text-amber-400 mt-1 transition-colors block text-left"
          >
            Inspect live sessions &rarr;
          </button>
        </div>
      </div>

      {/* Licence Expiry Warning Widget (if any schools nearing expiry) */}
      {(stats?.expiringSchools || []).length > 0 && (
        <div className="bg-[#0f172a] border border-amber-500/30 rounded-xl p-5 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <h3 className="font-bold text-sm text-white">
                Schools Nearing Licence Expiry ({stats?.expiringSchools.length})
              </h3>
            </div>
            <span className="text-xs text-amber-400 font-semibold">Requires Renewal Attention</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#111827] text-slate-400 font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-3">School Name</th>
                  <th className="p-3">Plan</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Days Remaining</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {stats?.expiringSchools.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30">
                    <td className="p-3 font-semibold text-white">
                      {s.name} <span className="text-slate-500 font-mono">({s.code})</span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        {s.plan}
                      </span>
                    </td>
                    <td className="p-3 text-slate-300 font-mono">
                      {new Date(s.licenseExpiresAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="p-3">
                      {s.daysRemaining < 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-400 border border-rose-500/30">
                          Expired ({Math.abs(s.daysRemaining)}d ago)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {s.daysRemaining} days left
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => navigate('/creator/features')}
                        className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[11px] font-bold"
                      >
                        Extend Licence
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Managed Schools Grid */}
      <div className="rounded-xl bg-[#0f172a] border border-slate-800 shadow-lg overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Managed Schools Directory</h2>
            <p className="text-xs text-slate-400">Enter any school in full view/manage mode with automated audit logging</p>
          </div>
          <button
            onClick={() => navigate('/creator/schools')}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
          >
            View all ({stats?.schools.length}) &rarr;
          </button>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(stats?.schools || []).map((school) => (
              <div
                key={school.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 hover:border-amber-500/50 transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-white text-sm truncate max-w-[200px]">
                        {school.name}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="font-mono text-xs text-amber-400">{school.code}</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-[11px] text-slate-400">{school.plan || 'CUSTOM'}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        school.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}
                    >
                      {school.status}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-3 pt-2.5 border-t border-slate-800/80 text-xs text-slate-400">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Students</span>
                      <span className="font-semibold text-white">{school.studentCount ?? 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[10px]">Staff</span>
                      <span className="font-semibold text-white">{school.staffCount ?? 0}</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end">
                  <button
                    disabled={enteringSchoolId === school.id}
                    onClick={() => handleEnterSchool(school)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 flex items-center gap-1.5 transition-all shadow-sm"
                  >
                    <span>{enteringSchoolId === school.id ? 'Entering...' : 'Enter School'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Global Activity & Architecture Status Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl bg-[#0f172a] border border-slate-800 p-5 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-amber-400" />
              <h3 className="text-sm font-bold text-white">Recent System Activity Stream</h3>
            </div>
            <button
              onClick={() => navigate('/creator/audit')}
              className="text-xs text-amber-400 hover:text-amber-300 font-semibold"
            >
              Full Audit Log &rarr;
            </button>
          </div>

          <div className="space-y-2">
            {(stats?.recentActivity || []).length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">No recent activity recorded.</p>
            ) : (
              (stats?.recentActivity || []).map((l) => (
                <div
                  key={l.id}
                  className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/60 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2.5 truncate max-w-[420px]">
                    <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700">
                      {l.action}
                    </span>
                    <span className="text-slate-300 truncate">{l.details || '-'}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-500 text-[11px] flex-shrink-0 font-mono">
                    <span>{l.schoolCode}</span>
                    <span>•</span>
                    <span>{formatDateTime(l.createdAt)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* System Control Architecture Status */}
        <div className="rounded-xl bg-[#0f172a] border border-slate-800 p-5 shadow-lg space-y-3">
          <div className="flex items-center gap-2 mb-1">
            <Layers className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold text-white">Creator Architecture Modules</h3>
          </div>

          <div className="space-y-2 text-xs">
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>(a) Creator Role & Login</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>(b) Multi-School Scoping</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>(c) School Management & Branding</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>(d) Super Admins Control</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>(e) Feature Toggles & Plans</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>(f) Sessions & Rollover Tool</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 flex items-center justify-between">
              <span>(g) System Control Centre</span>
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
