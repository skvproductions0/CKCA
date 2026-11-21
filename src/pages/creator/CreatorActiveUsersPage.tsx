import { useState, useEffect, useRef } from 'react';
import {
  Activity,
  Users,
  Search,
  RefreshCw,
  LogOut,
  Laptop,
  Globe,
  Clock,
  Building,
  AlertTriangle,
  CheckCircle2,
  Filter,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiCall, formatDateTime } from '../../utils/helpers';
import { ActiveSessionRecord, SchoolRecord } from '../../types';

export default function CreatorActiveUsersPage() {
  const { success, error: showError } = useToast();

  const [sessions, setSessions] = useState<ActiveSessionRecord[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [terminatingId, setTerminatingId] = useState<string | null>(null);
  const [terminatingSchool, setTerminatingSchool] = useState(false);

  // Terminate confirmation state
  const [confirmModal, setConfirmModal] = useState<{
    type: 'SESSION' | 'USER' | 'SCHOOL';
    id: string;
    label: string;
  } | null>(null);

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadSchools();
    loadActiveSessions();

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    if (autoRefresh) {
      pollIntervalRef.current = setInterval(() => {
        loadActiveSessions(false);
      }, 15000); // 15s poll
    }
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    };
  }, [autoRefresh, selectedSchoolId, searchTerm]);

  const loadSchools = async () => {
    try {
      const data = await apiCall(() => window.api.creator.schools.list({ limit: 100 }));
      setSchools(data?.schools || data || []);
    } catch {
      // Non-blocking
    }
  };

  const loadActiveSessions = async (showSpinner: boolean = true) => {
    if (showSpinner) setLoading(true);
    try {
      const filters: { schoolId?: string; search?: string } = {};
      if (selectedSchoolId !== 'ALL') filters.schoolId = selectedSchoolId;
      if (searchTerm.trim()) filters.search = searchTerm.trim();

      const data = await apiCall(() => window.api.creator.activeUsers.list(filters));
      setSessions(data || []);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load active sessions');
    } finally {
      if (showSpinner) setLoading(false);
    }
  };

  const handleForceLogoutSession = async (sessionId: string) => {
    setTerminatingId(sessionId);
    try {
      await apiCall(() => window.api.creator.activeUsers.forceLogoutSession(sessionId));
      success('User session terminated successfully.');
      setConfirmModal(null);
      await loadActiveSessions(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to terminate session');
    } finally {
      setTerminatingId(null);
    }
  };

  const handleForceLogoutSchool = async (schoolId: string) => {
    setTerminatingSchool(true);
    try {
      const res = await apiCall(() => window.api.creator.activeUsers.forceLogoutSchool(schoolId));
      success(`All active sessions (${res.count}) across the school terminated.`);
      setConfirmModal(null);
      await loadActiveSessions(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to terminate school sessions');
    } finally {
      setTerminatingSchool(false);
    }
  };

  const onlineSchoolsCount = new Set(sessions.map((s) => s.schoolId).filter(Boolean)).size;
  const activeSessionsCount = sessions.filter((s) => !s.isIdle).length;
  const idleSessionsCount = sessions.filter((s) => s.isIdle).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Live Active Users</h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live Online Monitor
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Real-time tracking of authenticated user sessions across all tenant schools with instant force logout controls.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
            />
            <span>Auto-refresh (15s)</span>
          </label>

          <button
            onClick={() => loadActiveSessions(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Total Online Sessions</p>
            <p className="text-2xl font-extrabold text-white mt-1">{sessions.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Across all connected schools</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Activity className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Active Working Now</p>
            <p className="text-2xl font-extrabold text-emerald-400 mt-1">{activeSessionsCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Interacted &lt; 15 mins ago</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Idle / Background</p>
            <p className="text-2xl font-extrabold text-slate-400 mt-1">{idleSessionsCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">No activity &gt; 15 mins</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Online Schools</p>
            <p className="text-2xl font-extrabold text-indigo-400 mt-1">{onlineSchoolsCount}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">With active staff sessions</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Building className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search user, name, school code, or IP..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && loadActiveSessions(true)}
              className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* School Dropdown */}
          <div className="min-w-[220px]">
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">All Schools</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => loadActiveSessions(true)}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
          >
            <Filter className="w-3.5 h-3.5" /> Filter
          </button>
        </div>

        {/* School-wide force logout button if single school selected */}
        {selectedSchoolId !== 'ALL' && sessions.length > 0 && (
          <button
            onClick={() => {
              const schoolObj = schools.find((s) => s.id === selectedSchoolId);
              setConfirmModal({
                type: 'SCHOOL',
                id: selectedSchoolId,
                label: schoolObj?.name || 'Selected School',
              });
            }}
            className="px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" /> Terminate All School Sessions
          </button>
        )}
      </div>

      {/* Live Sessions Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-white">Connected User Sessions</h3>
            <span className="text-xs text-slate-400">({sessions.length} live)</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">Auto-refreshed every 15s</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-sm">Fetching online sessions...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#111827] text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">User & Role</th>
                  <th className="p-4">School</th>
                  <th className="p-4">Device / Client</th>
                  <th className="p-4">IP Address</th>
                  <th className="p-4">Login Time</th>
                  <th className="p-4">Last Activity</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* User */}
                    <td className="p-4">
                      <div className="font-bold text-white text-sm">{s.fullName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-slate-400 text-[11px]">@{s.username}</span>
                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {s.role}
                        </span>
                      </div>
                    </td>

                    {/* School */}
                    <td className="p-4">
                      <span className="font-semibold text-slate-200 block">{s.schoolName}</span>
                      <span className="font-mono text-[11px] text-slate-500">{s.schoolCode}</span>
                    </td>

                    {/* Device */}
                    <td className="p-4 text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Laptop className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate max-w-[160px]">{s.device}</span>
                      </div>
                    </td>

                    {/* IP */}
                    <td className="p-4 font-mono text-slate-300">
                      <div className="flex items-center gap-1.5">
                        <Globe className="w-3.5 h-3.5 text-slate-500" />
                        <span>{s.ipAddress}</span>
                      </div>
                    </td>

                    {/* Login Time */}
                    <td className="p-4 text-slate-400 whitespace-nowrap">
                      {formatDateTime(s.loginTime)}
                    </td>

                    {/* Last Activity */}
                    <td className="p-4 text-slate-300 whitespace-nowrap font-mono text-[11px]">
                      {formatDateTime(s.lastActiveAt)}
                    </td>

                    {/* Status */}
                    <td className="p-4">
                      {s.isIdle ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                          Idle (&gt;15m)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                          Active
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      {s.role !== 'CREATOR' && (
                        <button
                          onClick={() =>
                            setConfirmModal({
                              type: 'SESSION',
                              id: s.id,
                              label: `${s.fullName} (@${s.username})`,
                            })
                          }
                          disabled={terminatingId === s.id}
                          className="px-2.5 py-1.5 bg-rose-600/10 hover:bg-rose-600 text-rose-400 hover:text-white rounded-lg text-xs font-bold transition-colors border border-rose-500/20"
                          title="Force Logout this session"
                        >
                          <LogOut className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}

                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-12 text-center text-slate-400">
                      <Users className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                      <p className="text-sm font-medium">No active sessions matching filter.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 mx-auto flex items-center justify-center border border-rose-500/20">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center">
              <h3 className="text-base font-bold text-white">
                {confirmModal.type === 'SCHOOL'
                  ? 'Force Logout All School Users?'
                  : 'Terminate Active Session?'}
              </h3>
              <p className="text-xs text-slate-400 mt-1.5">
                {confirmModal.type === 'SCHOOL' ? (
                  <>
                    Are you sure you want to terminate all active sessions for{' '}
                    <strong className="text-white">{confirmModal.label}</strong>? All connected staff
                    will be immediately signed out.
                  </>
                ) : (
                  <>
                    Are you sure you want to terminate the active session for{' '}
                    <strong className="text-white">{confirmModal.label}</strong>?
                  </>
                )}
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmModal.type === 'SCHOOL') {
                    handleForceLogoutSchool(confirmModal.id);
                  } else {
                    handleForceLogoutSession(confirmModal.id);
                  }
                }}
                disabled={Boolean(terminatingId) || terminatingSchool}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Confirm Force Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
