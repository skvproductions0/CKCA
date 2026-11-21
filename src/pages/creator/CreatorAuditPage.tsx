import { useState, useEffect } from 'react';
import {
  History,
  Search,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiCall, formatDateTime } from '../../utils/helpers';
import { exportToExcel } from '../../utils/export';
import { GlobalAuditRecord, SchoolRecord } from '../../types';

const COMMON_ACTIONS = [
  'ALL',
  'LOGIN',
  'LOGOUT',
  'CREATOR_ENTER_SCHOOL',
  'CREATOR_EXIT_SCHOOL',
  'SCHOOL_CREATED',
  'SCHOOL_UPDATED',
  'SCHOOL_SUSPENDED',
  'SCHOOL_REACTIVATED',
  'SCHOOL_ARCHIVED',
  'SUPER_ADMIN_CREATED',
  'SUPER_ADMIN_PASSWORD_RESET',
  'SUPER_ADMIN_LOCKED',
  'SUPER_ADMIN_UNLOCKED',
  'SUPER_ADMIN_FORCE_LOGOUT',
  'FEATURE_TOGGLED',
  'PLAN_PRESET_APPLIED',
  'LIMITS_UPDATED',
  'ACADEMIC_SESSION_CREATED',
  'ACADEMIC_SESSION_ACTIVATED',
  'SESSION_ROLLOVER_EXECUTED',
  'BACKUP_CREATED',
  'DATABASE_RESTORED',
  'SYSTEM_SETTINGS_UPDATED',
  'USER_FORCE_LOGOUT',
  'SCHOOL_FORCE_LOGOUT',
];

export default function CreatorAuditPage() {
  const { success, error: showError } = useToast();

  const [logs, setLogs] = useState<GlobalAuditRecord[]>([]);
  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Filter state
  const [selectedSchoolId, setSelectedSchoolId] = useState('ALL');
  const [selectedAction, setSelectedAction] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    loadAuditLogs(page);
  }, [page, selectedSchoolId, selectedAction, startDate, endDate]);

  const loadSchools = async () => {
    try {
      const data = await apiCall(() => window.api.creator.schools.list({ limit: 100 }));
      setSchools(data?.schools || data || []);
    } catch {
      // Non-blocking
    }
  };

  const loadAuditLogs = async (targetPage: number = 1) => {
    setLoading(true);
    try {
      const filters = {
        schoolId: selectedSchoolId,
        action: selectedAction,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm.trim() || undefined,
        page: targetPage,
        limit: 25,
      };

      const res = await apiCall(() => window.api.creator.audit.list(filters));
      setLogs(res.logs || []);
      setTotal(res.total || 0);
      setPage(res.page || 1);
      setTotalPages(res.totalPages || 1);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedSchoolId('ALL');
    setSelectedAction('ALL');
    setStartDate('');
    setEndDate('');
    setSearchTerm('');
    setPage(1);
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      // Fetch up to 1000 matching records for the export
      const filters = {
        schoolId: selectedSchoolId,
        action: selectedAction,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        search: searchTerm.trim() || undefined,
        page: 1,
        limit: 1000,
      };

      const res = await apiCall(() => window.api.creator.audit.list(filters));
      const exportData = (res.logs || []).map((l: GlobalAuditRecord) => ({
        timestamp: formatDateTime(l.createdAt),
        schoolName: l.schoolName,
        schoolCode: l.schoolCode,
        userName: l.fullName,
        username: l.username,
        role: l.role,
        action: l.action,
        entity: l.entity || '-',
        entityId: l.entityId || '-',
        details: l.details || '-',
      }));

      const columns = [
        { header: 'Timestamp', key: 'timestamp', width: 22 },
        { header: 'School Name', key: 'schoolName', width: 25 },
        { header: 'School Code', key: 'schoolCode', width: 14 },
        { header: 'User', key: 'userName', width: 20 },
        { header: 'Username', key: 'username', width: 16 },
        { header: 'Role', key: 'role', width: 16 },
        { header: 'Action Taken', key: 'action', width: 26 },
        { header: 'Entity', key: 'entity', width: 16 },
        { header: 'Entity ID', key: 'entityId', width: 20 },
        { header: 'Event Details', key: 'details', width: 45 },
      ];

      const dateStr = new Date().toISOString().split('T')[0];
      await exportToExcel(exportData, columns, `global-system-audit-log-${dateStr}`);
      success('Audit log successfully exported to Excel!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to export audit log');
    } finally {
      setExporting(false);
    }
  };

  const getActionBadgeClass = (action: string) => {
    if (action.includes('ARCHIVE') || action.includes('FORCE_LOGOUT') || action.includes('SUSPEND') || action.includes('RESTORE')) {
      return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
    if (action.includes('CREATED') || action.includes('ACTIVATED') || action.includes('REACTIVATE') || action.includes('BACKUP')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (action.includes('ROLLOVER') || action.includes('PLAN') || action.includes('LIMITS') || action.includes('TOGGLED')) {
      return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    }
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Global Audit Log</h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Full System Traceability
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Immutable system-wide compliance ledger recording all administrative, tenancy, security, and lifecycle actions.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => loadAuditLogs(page)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExportExcel}
            disabled={exporting || logs.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-emerald-600/20 disabled:opacity-50"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting...' : 'Export to Excel'}
          </button>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Search Keywords</label>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="User, detail, entity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadAuditLogs(1)}
                className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg pl-8 pr-2.5 py-2 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          {/* School Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Filter by School</label>
            <select
              value={selectedSchoolId}
              onChange={(e) => {
                setSelectedSchoolId(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              <option value="ALL">All Schools (System-wide)</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>
          </div>

          {/* Action Selector */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Event Action Type</label>
            <select
              value={selectedAction}
              onChange={(e) => {
                setSelectedAction(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500 cursor-pointer font-mono text-[11px]"
            >
              {COMMON_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Start */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">From Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Date Range End */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">To Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-2.5 py-2 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
          <span className="text-xs text-slate-400">
            Showing <strong className="text-white">{logs.length}</strong> of{' '}
            <strong className="text-amber-400">{total}</strong> total audit events
          </span>

          <div className="flex items-center gap-2">
            {(selectedSchoolId !== 'ALL' || selectedAction !== 'ALL' || startDate || endDate || searchTerm) && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded hover:bg-slate-800 transition-colors"
              >
                Reset Filters
              </button>
            )}
            <button
              onClick={() => loadAuditLogs(1)}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
            >
              <Filter className="w-3 h-3" /> Apply Filter
            </button>
          </div>
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-sm">Querying audit logs...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#111827] text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4 w-40">Timestamp</th>
                  <th className="p-4 w-44">School</th>
                  <th className="p-4 w-44">User</th>
                  <th className="p-4 w-52">Action</th>
                  <th className="p-4">Event Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                    {/* Timestamp */}
                    <td className="p-4 font-mono text-slate-400 whitespace-nowrap text-[11px]">
                      {formatDateTime(l.createdAt)}
                    </td>

                    {/* School */}
                    <td className="p-4">
                      <span className="font-semibold text-slate-200 block truncate max-w-[160px]">
                        {l.schoolName}
                      </span>
                      <span className="font-mono text-[10px] text-slate-500">{l.schoolCode}</span>
                    </td>

                    {/* User */}
                    <td className="p-4">
                      <span className="font-semibold text-white block">{l.fullName}</span>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                        <span className="font-mono">@{l.username}</span>
                        <span>•</span>
                        <span className="font-semibold text-slate-300">{l.role}</span>
                      </div>
                    </td>

                    {/* Action */}
                    <td className="p-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold font-mono border ${getActionBadgeClass(
                          l.action
                        )}`}
                      >
                        {l.action}
                      </span>
                      {l.entity && (
                        <span className="block text-[10px] text-slate-500 mt-1 font-mono">
                          Target: {l.entity}
                        </span>
                      )}
                    </td>

                    {/* Details */}
                    <td className="p-4 text-slate-300 text-xs">
                      <p className="leading-relaxed">{l.details || '-'}</p>
                    </td>
                  </tr>
                ))}

                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-16 text-center text-slate-400">
                      <History className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                      <p className="text-sm font-medium">No audit log records found matching your filters.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="p-3.5 border-t border-slate-800 flex items-center justify-between bg-[#0b101d] text-xs">
            <span className="text-slate-400">
              Page <strong className="text-white">{page}</strong> of{' '}
              <strong className="text-white">{totalPages}</strong>
            </span>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 bg-[#111827] hover:bg-slate-800 text-slate-300 rounded border border-slate-700 disabled:opacity-40 flex items-center gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1.5 bg-[#111827] hover:bg-slate-800 text-slate-300 rounded border border-slate-700 disabled:opacity-40 flex items-center gap-1"
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
