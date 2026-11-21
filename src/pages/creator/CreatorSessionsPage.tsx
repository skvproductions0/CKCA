import { useState, useEffect } from 'react';
import {
  Calendar,
  Plus,
  CheckCircle2,
  Lock,
  ArrowRight,
  TrendingUp,
  AlertTriangle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiCall, formatDate, formatCurrency } from '../../utils/helpers';
import { AcademicSessionRecord, RolloverPreviewResult, SchoolRecord } from '../../types';

export default function CreatorSessionsPage() {
  const { success, error: showError } = useToast();

  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [sessions, setSessions] = useState<AcademicSessionRecord[]>([]);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Add session modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({
    name: `${new Date().getFullYear() + 1}-${String(new Date().getFullYear() + 2).slice(-2)}`,
    startDate: `${new Date().getFullYear() + 1}-04-01`,
    endDate: `${new Date().getFullYear() + 2}-03-31`,
    isCurrent: false,
  });
  const [savingSession, setSavingSession] = useState(false);

  // Rollover wizard
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [sourceSessionId, setSourceSessionId] = useState<string>('');
  const [targetSessionId, setTargetSessionId] = useState<string>('');
  const [carryForwardDues, setCarryForwardDues] = useState(true);
  const [setActiveAfterRollover, setSetActiveAfterRollover] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<RolloverPreviewResult | null>(null);
  const [studentOverrides, setStudentOverrides] = useState<Record<string, 'PROMOTE' | 'RETAIN' | 'GRADUATE' | 'SKIP'>>({});
  const [executingRollover, setExecutingRollover] = useState(false);
  const [rolloverSummary, setRolloverSummary] = useState<any | null>(null);

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (selectedSchoolId) {
      loadSessions(selectedSchoolId);
    }
  }, [selectedSchoolId]);

  const loadSchools = async () => {
    setLoadingSchools(true);
    try {
      const res = await apiCall(() => window.api.creator.schools.list({ limit: 100 }));
      const list = res.schools || [];
      setSchools(list);
      if (list.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(list[0].id);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load schools');
    } finally {
      setLoadingSchools(false);
    }
  };

  const loadSessions = async (schoolId: string) => {
    setLoadingSessions(true);
    try {
      const list = await apiCall(() => window.api.creator.sessions.list(schoolId));
      setSessions(list || []);

      // Auto-populate rollover defaults
      if (list && list.length >= 2) {
        const active = list.find((s) => s.isCurrent) || list[0];
        setSourceSessionId(active.id);
        const next = list.find((s) => s.id !== active.id);
        if (next) setTargetSessionId(next.id);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load academic sessions');
    } finally {
      setLoadingSessions(false);
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) return;
    if (!addForm.name.trim()) {
      showError('Please enter a session name (e.g. 2027-28).');
      return;
    }
    setSavingSession(true);
    try {
      await apiCall(() =>
        window.api.creator.sessions.create(selectedSchoolId, {
          name: addForm.name.trim(),
          startDate: addForm.startDate,
          endDate: addForm.endDate,
          isCurrent: addForm.isCurrent,
        })
      );
      setShowAddModal(false);
      await loadSessions(selectedSchoolId);
      success(`Academic Session ${addForm.name} created successfully!`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create academic session');
    } finally {
      setSavingSession(false);
    }
  };

  const handleSetActive = async (sessionId: string, sessionName: string) => {
    if (!selectedSchoolId) return;
    try {
      await apiCall(() => window.api.creator.sessions.setActive(sessionId, selectedSchoolId));
      await loadSessions(selectedSchoolId);
      success(`Session ${sessionName} is now the active academic session!`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to set active session');
    }
  };

  const handleGeneratePreview = async () => {
    if (!selectedSchoolId || !sourceSessionId || !targetSessionId) {
      showError('Please select both source and target sessions.');
      return;
    }
    setPreviewLoading(true);
    try {
      const preview = await apiCall(() =>
        window.api.creator.sessions.previewRollover(sourceSessionId, targetSessionId, selectedSchoolId)
      );
      setPreviewResult(preview);
      setStudentOverrides({});
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to generate rollover preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecuteRollover = async () => {
    if (!selectedSchoolId || !sourceSessionId || !targetSessionId) return;
    setExecutingRollover(true);
    try {
      const summary = await apiCall(() =>
        window.api.creator.sessions.executeRollover(
          {
            sourceSessionId,
            targetSessionId,
            carryForwardDues,
            setActive: setActiveAfterRollover,
            studentOverrides,
          },
          selectedSchoolId
        )
      );
      setRolloverSummary(summary);
      await loadSessions(selectedSchoolId);
      success('Session rollover executed successfully!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to execute session rollover');
    } finally {
      setExecutingRollover(false);
    }
  };

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);
  const activeSession = sessions.find((s) => s.isCurrent);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Academic Sessions Control</h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Session Governance & Rollover
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage academic terms, enforce exactly one active session per school, and promote students with the Rollover Tool.
          </p>
        </div>

        {/* School Selector */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[280px]">
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              disabled={loadingSchools}
              className="w-full bg-[#111827] border border-slate-700 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) - {s.status}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-amber-600/20 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" /> Add Session
          </button>
        </div>
      </div>

      {/* School Status Banner */}
      {selectedSchool && (
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h2 className="text-lg font-bold text-white">{selectedSchool.name}</h2>
                <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {selectedSchool.code}
                </span>
                {activeSession ? (
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Active Session: {activeSession.name}
                  </span>
                ) : (
                  <span className="text-xs font-bold px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> No Active Session
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Total Sessions: <span className="text-white font-semibold">{sessions.length}</span> •
                Historical sessions are strictly read-only to preserve ledger and audit compliance.
              </p>
            </div>
          </div>

          {sessions.length >= 2 && (
            <button
              onClick={() => {
                setPreviewResult(null);
                setShowRolloverModal(true);
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-indigo-600/20"
            >
              <TrendingUp className="w-4 h-4" /> Session Rollover Wizard
            </button>
          )}
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">Academic Sessions Register</h3>
          <span className="text-xs text-slate-400">Exactly 1 session active at any time</span>
        </div>

        {loadingSessions ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-sm">Loading sessions...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#111827] text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Session Name</th>
                  <th className="p-4">Date Range</th>
                  <th className="p-4">Enrolled Students</th>
                  <th className="p-4">Exams & Payments</th>
                  <th className="p-4">Status & Access Mode</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {sessions.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="p-4 font-bold text-white text-sm">
                      <div className="flex items-center gap-2">
                        {s.name}
                        {s.isCurrent && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            CURRENT
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-slate-300">
                      {formatDate(s.startDate)} — {formatDate(s.endDate)}
                    </td>
                    <td className="p-4">
                      <span className="font-mono font-semibold text-slate-200">
                        {s.studentCount || 0} students
                      </span>
                    </td>
                    <td className="p-4 text-slate-400">
                      <span>{s.examCount || 0} exams</span> • <span>{s.paymentCount || 0} receipts</span>
                    </td>
                    <td className="p-4">
                      {s.isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Active & Writable
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          <Lock className="w-3 h-3 text-slate-400" /> Historical (Read-Only)
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {!s.isCurrent && (
                        <button
                          onClick={() => handleSetActive(s.id, s.name)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs border border-slate-700 hover:border-slate-600 transition-colors"
                        >
                          Set as Active
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-slate-500">
                      No academic sessions found for this school. Click "+ Add Session" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Session Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create Academic Session</h3>
                <p className="text-xs text-slate-400">
                  Add a new school session for <strong className="text-slate-200">{selectedSchool?.name}</strong>.
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateSession} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Session Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2027-28"
                  value={addForm.name}
                  onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full bg-[#111827] border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500 font-mono"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Start Date *
                  </label>
                  <input
                    type="date"
                    value={addForm.startDate}
                    onChange={(e) => setAddForm({ ...addForm, startDate: e.target.value })}
                    className="w-full bg-[#111827] border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    End Date *
                  </label>
                  <input
                    type="date"
                    value={addForm.endDate}
                    onChange={(e) => setAddForm({ ...addForm, endDate: e.target.value })}
                    className="w-full bg-[#111827] border border-slate-700 text-white text-sm rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>
              </div>

              <label className="flex items-start gap-2.5 pt-1 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={addForm.isCurrent}
                  onChange={(e) => setAddForm({ ...addForm, isCurrent: e.target.checked })}
                  className="mt-0.5 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                />
                <span>Set as Active session immediately (sets previous session to read-only)</span>
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingSession}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-amber-600/20 disabled:opacity-50"
                >
                  {savingSession ? 'Creating...' : 'Create Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rollover Wizard Modal */}
      {showRolloverModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl max-w-4xl w-full p-6 shadow-2xl space-y-5 my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Session Rollover & Student Promotion Tool</h3>
                  <p className="text-xs text-slate-400">
                    Promote students to the next class and carry forward unpaid fee balances to the new session.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowRolloverModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* Session Selectors */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-900/60 p-4 rounded-xl border border-slate-800">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Source Session (Current Students)
                </label>
                <select
                  value={sourceSessionId}
                  onChange={(e) => setSourceSessionId(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.isCurrent ? '★ (Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Target Session (Promoted Session)
                </label>
                <select
                  value={targetSessionId}
                  onChange={(e) => setTargetSessionId(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                >
                  {sessions.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.id === sourceSessionId}>
                      {s.name} {s.isCurrent ? '★ (Active)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 flex flex-col sm:flex-row gap-4 pt-2">
                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={carryForwardDues}
                    onChange={(e) => setCarryForwardDues(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Carry forward pending fee balances as opening dues in new session</span>
                </label>

                <label className="flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setActiveAfterRollover}
                    onChange={(e) => setSetActiveAfterRollover(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                  />
                  <span>Set target session as ACTIVE upon successful rollover</span>
                </label>
              </div>

              <div className="md:col-span-2 pt-2">
                <button
                  type="button"
                  onClick={handleGeneratePreview}
                  disabled={previewLoading || sourceSessionId === targetSessionId}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {previewLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="w-3.5 h-3.5" />
                  )}
                  {previewLoading ? 'Generating Preview...' : 'Generate Rollover Preview'}
                </button>
              </div>
            </div>

            {/* Preview Results */}
            {previewResult && (
              <div className="space-y-4">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-slate-400">Total Eligible</p>
                    <p className="text-lg font-bold text-white mt-0.5">{previewResult.totalStudents}</p>
                  </div>
                  <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-slate-400">To Promote</p>
                    <p className="text-lg font-bold text-emerald-400 mt-0.5">
                      {previewResult.toPromoteCount}
                    </p>
                  </div>
                  <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-slate-400">To Graduate (Alumni)</p>
                    <p className="text-lg font-bold text-amber-400 mt-0.5">
                      {previewResult.toGraduateCount}
                    </p>
                  </div>
                  <div className="bg-[#111827] border border-slate-800 rounded-lg p-3 text-center">
                    <p className="text-[11px] text-slate-400">Dues Carry-Forward</p>
                    <p className="text-lg font-bold text-indigo-400 mt-0.5">
                      {formatCurrency(previewResult.totalPendingDuesPaise)}
                    </p>
                  </div>
                </div>

                {/* Class Progression Chips */}
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-800">
                  <p className="text-xs font-semibold text-slate-300 mb-2">Class Flow Breakdown:</p>
                  <div className="flex flex-wrap gap-2">
                    {previewResult.classSummaries.map((cs, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-1 rounded bg-[#111827] border border-slate-700 text-xs text-slate-300 flex items-center gap-1.5"
                      >
                        <span className="font-semibold text-white">{cs.fromClass}</span>
                        <ArrowRight className="w-3 h-3 text-amber-400" />
                        <span className="font-semibold text-emerald-300">{cs.toClass}</span>
                        <span className="ml-1 text-[11px] font-mono font-bold text-slate-400 bg-slate-800 px-1 rounded">
                          ({cs.count})
                        </span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Detailed Student Preview Table (scrollable) */}
                <div className="border border-slate-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-[#111827] text-slate-400 uppercase font-semibold sticky top-0 z-10 border-b border-slate-800">
                      <tr>
                        <th className="p-3">Student</th>
                        <th className="p-3">Current Class</th>
                        <th className="p-3">Proposed Target</th>
                        <th className="p-3">Pending Due</th>
                        <th className="p-3">Action Override</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60 bg-[#0b101d]">
                      {previewResult.students.map((st) => {
                        const currentAction = studentOverrides[st.studentId] || st.action;
                        return (
                          <tr key={st.studentId} className="hover:bg-slate-800/20">
                            <td className="p-3">
                              <span className="font-semibold text-white">{st.name}</span>
                              <span className="block text-[10px] text-slate-500 font-mono">
                                {st.admissionNumber}
                              </span>
                            </td>
                            <td className="p-3 text-slate-300">{st.currentClassName}</td>
                            <td className="p-3 font-semibold text-emerald-400">{st.nextClassName}</td>
                            <td className="p-3 font-mono text-slate-300">
                              {st.pendingDuePaise > 0 ? (
                                <span className="text-amber-400 font-bold">
                                  {formatCurrency(st.pendingDuePaise)}
                                </span>
                              ) : (
                                <span className="text-slate-500">₹0</span>
                              )}
                            </td>
                            <td className="p-3">
                              <select
                                value={currentAction}
                                onChange={(e) =>
                                  setStudentOverrides({
                                    ...studentOverrides,
                                    [st.studentId]: e.target.value as any,
                                  })
                                }
                                className="bg-[#111827] border border-slate-700 text-white rounded px-2 py-1 text-[11px] focus:outline-none focus:border-amber-500"
                              >
                                <option value="PROMOTE">Promote</option>
                                <option value="RETAIN">Retain (Repeat)</option>
                                <option value="GRADUATE">Graduate</option>
                                <option value="SKIP">Skip</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Final Rollover Action Button */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowRolloverModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteRollover}
                    disabled={executingRollover}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-lg shadow-emerald-600/20 flex items-center gap-2"
                  >
                    {executingRollover ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    {executingRollover ? 'Processing Rollover...' : 'Confirm & Execute Rollover'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rollover Success Modal */}
      {rolloverSummary && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-emerald-500/40 rounded-xl max-w-md w-full p-6 shadow-2xl text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/20 text-emerald-400 mx-auto flex items-center justify-center border border-emerald-500/30">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div>
              <h3 className="text-lg font-bold text-white">Session Rollover Complete!</h3>
              <p className="text-xs text-slate-400 mt-1">
                Rolled over from <strong className="text-slate-200">{rolloverSummary.sourceSession.name}</strong> to{' '}
                <strong className="text-emerald-300">{rolloverSummary.targetSession.name}</strong>.
              </p>
            </div>

            <div className="bg-[#111827] p-3.5 rounded-lg border border-slate-800 text-xs space-y-2 text-left">
              <div className="flex justify-between">
                <span className="text-slate-400">Promoted Students:</span>
                <span className="font-bold text-emerald-400">{rolloverSummary.promoted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Graduated (Alumni):</span>
                <span className="font-bold text-amber-400">{rolloverSummary.graduated}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Retained Students:</span>
                <span className="font-bold text-slate-300">{rolloverSummary.retained}</span>
              </div>
              <div className="flex justify-between border-t border-slate-800 pt-1.5">
                <span className="text-slate-400">Dues Carried Forward:</span>
                <span className="font-bold text-indigo-400">
                  {formatCurrency(rolloverSummary.duesCarriedForwardPaise)}
                </span>
              </div>
            </div>

            <button
              onClick={() => {
                setRolloverSummary(null);
                setShowRolloverModal(false);
              }}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-emerald-600/20"
            >
              Done & Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
