import { useState, useEffect } from 'react';
import { Plus, CheckCircle2, TrendingUp, Sparkles, ArrowRight } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, Badge } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ROLE_LABELS, ROLE_PERMISSIONS, formatDate, formatCurrency, apiCall } from '../../utils/helpers';
import { RolloverPreviewResult } from '../../types';

const PERMISSION_FEATURE_MAP: Record<string, string> = {
  students: 'students',
  'students.view': 'students',
  'students.search': 'students',
  admissions: 'admissions',
  classes: 'classes',
  'classes.view': 'classes',
  teachers: 'teachers',
  subjects: 'subjects',
  fees: 'fees',
  'fees.view': 'fees',
  payments: 'payments',
  receipts: 'payments',
  'reports.fees': 'fees',
  attendance: 'attendance',
  exams: 'examinations',
  results: 'results',
  reports: 'reports',
  notifications: 'notifications',
  backup: 'backup',
};

export default function SettingsPage() {
  const { schoolSettings, academicYears, setAcademicYear, refreshSettings, isFeatureEnabled } = useApp();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState('school');
  const [form, setForm] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [grading, setGrading] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYearForm, setNewYearForm] = useState({
    name: `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`,
    startDate: `${new Date().getFullYear()}-04-01`,
    endDate: `${new Date().getFullYear() + 1}-03-31`,
    isCurrent: false,
  });
  const [savingYear, setSavingYear] = useState(false);

  // Rollover state
  const [showRolloverModal, setShowRolloverModal] = useState(false);
  const [sourceSessionId, setSourceSessionId] = useState('');
  const [targetSessionId, setTargetSessionId] = useState('');
  const [carryForwardDues, setCarryForwardDues] = useState(true);
  const [setActiveAfterRollover, setSetActiveAfterRollover] = useState(true);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<RolloverPreviewResult | null>(null);
  const [executingRollover, setExecutingRollover] = useState(false);
  const [studentOverrides, setStudentOverrides] = useState<Record<string, 'PROMOTE' | 'RETAIN' | 'GRADUATE' | 'SKIP'>>({});

  useEffect(() => {
    if (schoolSettings) {
      setForm({
        schoolName: (schoolSettings.schoolName as string) || '',
        address: (schoolSettings.address as string) || '',
        phone: (schoolSettings.phone as string) || '',
        email: (schoolSettings.email as string) || '',
        website: (schoolSettings.website as string) || '',
        principalName: (schoolSettings.principalName as string) || '',
        registrationNumber: (schoolSettings.registrationNumber as string) || '',
        receiptFooter: (schoolSettings.receiptFooter as string) || '',
        reportCardFooter: (schoolSettings.reportCardFooter as string) || '',
      });
    }
  }, [schoolSettings]);

  useEffect(() => {
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'grading') loadGrading();
    if (activeTab === 'academicYears') refreshSettings();
  }, [activeTab]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await apiCall(() => window.api.settings.getUsers());
      setUsers(data as Record<string, unknown>[]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadGrading = async () => {
    setLoading(true);
    try {
      const data = await apiCall(() => window.api.grading.list());
      setGrading(data as Record<string, unknown>[]);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleSaveSchool = async () => {
    setSaving(true);
    try {
      await apiCall(() => window.api.settings.updateSchool(form));
      await refreshSettings();
      success('Settings saved');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAcademicYear = async () => {
    if (!newYearForm.name.trim()) {
      showError('Please enter an academic year name (e.g. 2026-27).');
      return;
    }
    if (!newYearForm.startDate || !newYearForm.endDate) {
      showError('Please provide both start and end dates.');
      return;
    }
    setSavingYear(true);
    try {
      await apiCall(() =>
        window.api.academicYears.create({
          name: newYearForm.name.trim(),
          startDate: newYearForm.startDate,
          endDate: newYearForm.endDate,
          isCurrent: newYearForm.isCurrent,
        })
      );
      await refreshSettings();
      setShowAddYearModal(false);
      success(`Academic Year ${newYearForm.name} created successfully!`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create academic year');
    } finally {
      setSavingYear(false);
    }
  };

  const handleSetCurrentYear = async (id: string, name: string) => {
    try {
      await apiCall(() => window.api.academicYears.setCurrent(id));
      setAcademicYear({ id, name });
      await refreshSettings();
      success(`Academic Year ${name} is now set as active!`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to set active academic year');
    }
  };

  const handleOpenRollover = () => {
    if (academicYears.length >= 2) {
      const active = academicYears.find((y) => y.isCurrent) || academicYears[0];
      setSourceSessionId(active.id);
      const next = academicYears.find((y) => y.id !== active.id);
      if (next) setTargetSessionId(next.id);
    }
    setStudentOverrides({});
    setPreviewResult(null);
    setShowRolloverModal(true);
  };

  const handleGeneratePreview = async () => {
    if (!sourceSessionId || !targetSessionId) {
      showError('Please select both source and target sessions.');
      return;
    }
    setPreviewLoading(true);
    try {
      const preview = await apiCall(() =>
        window.api.academicYears.previewRollover(sourceSessionId, targetSessionId)
      );
      setPreviewResult(preview);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to generate rollover preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleExecuteRollover = async () => {
    if (!sourceSessionId || !targetSessionId) return;
    setExecutingRollover(true);
    try {
      await apiCall(() =>
        window.api.academicYears.executeRollover({
          sourceSessionId,
          targetSessionId,
          carryForwardDues,
          setActive: setActiveAfterRollover,
          studentOverrides,
        })
      );
      await refreshSettings();
      setShowRolloverModal(false);
      success('Session rollover executed successfully! Students promoted.');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to execute session rollover');
    } finally {
      setExecutingRollover(false);
    }
  };

  const tabs = [
    { id: 'school', label: 'School Settings' },
    { id: 'academicYears', label: 'Academic Years' },
    { id: 'grading', label: 'Grading System' },
    { id: 'users', label: 'User Management' },
    { id: 'permissions', label: 'Roles & Permissions' },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure school, academic years, and system settings" />

      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'school' && (
        <div className="card p-6 max-w-2xl space-y-4">
          <Input label="School Name" value={form.schoolName} onChange={e => setForm({ ...form, schoolName: e.target.value })} />
          <Input label="Address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          </div>
          <Input label="Website" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })} />
          <Input label="Principal Name" value={form.principalName} onChange={e => setForm({ ...form, principalName: e.target.value })} />
          <Input label="Registration Number" value={form.registrationNumber} onChange={e => setForm({ ...form, registrationNumber: e.target.value })} />
          <Input label="Receipt Footer" value={form.receiptFooter} onChange={e => setForm({ ...form, receiptFooter: e.target.value })} />
          <Input label="Report Card Footer" value={form.reportCardFooter} onChange={e => setForm({ ...form, reportCardFooter: e.target.value })} />
          <Button onClick={handleSaveSchool} loading={saving}>Save Settings</Button>
        </div>
      )}

      {activeTab === 'academicYears' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-sm text-gray-500">
              Manage academic sessions for student admissions, classes, examinations, and fee collection.
            </p>
            <div className="flex items-center gap-2">
              {academicYears.length >= 2 && (
                <Button variant="secondary" onClick={handleOpenRollover}>
                  <TrendingUp className="w-4 h-4" /> Rollover Tool
                </Button>
              )}
              <Button onClick={() => setShowAddYearModal(true)}>
                <Plus className="w-4 h-4" /> Add Academic Year
              </Button>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left p-4">Academic Year</th>
                  <th className="text-left p-4">Start Date</th>
                  <th className="text-left p-4">End Date</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {academicYears.map(y => (
                  <tr key={y.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-4 font-semibold text-gray-900 dark:text-gray-100">{y.name}</td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">
                      {'startDate' in y && y.startDate ? formatDate(y.startDate as string) : '-'}
                    </td>
                    <td className="p-4 text-gray-600 dark:text-gray-400">
                      {'endDate' in y && y.endDate ? formatDate(y.endDate as string) : '-'}
                    </td>
                    <td className="p-4">
                      {y.isCurrent ? (
                        <Badge variant="success">Current / Active</Badge>
                      ) : (
                        <Badge variant="info">Inactive</Badge>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      {!y.isCurrent && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleSetCurrentYear(y.id, y.name)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Set as Current
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {academicYears.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-500">
                      No academic years configured. Click "+ Add Academic Year" to create one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'grading' && (
        <div className="card overflow-hidden">
          {loading ? <LoadingSpinner /> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr><th className="text-left p-4">Grade</th><th className="text-left p-4">Min %</th><th className="text-left p-4">Max %</th></tr>
              </thead>
              <tbody>
                {grading.map(g => (
                  <tr key={g.id as string} className="border-t border-gray-100">
                    <td className="p-4 font-bold">{g.grade as string}</td>
                    <td className="p-4">{g.minPercent as number}</td>
                    <td className="p-4">{g.maxPercent as number}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="card overflow-hidden">
          {loading ? <LoadingSpinner /> : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr><th className="text-left p-4">Username</th><th className="text-left p-4">Name</th><th className="text-left p-4">Role</th><th className="text-left p-4">Status</th></tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id as string} className="border-t border-gray-100">
                    <td className="p-4 font-mono">{u.username as string}</td>
                    <td className="p-4">{u.fullName as string}</td>
                    <td className="p-4">{ROLE_LABELS[u.role as string]}</td>
                    <td className="p-4">{u.isActive ? 'Active' : 'Inactive'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'permissions' && (
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Current role permission mappings for this school. Note: Permissions for modules toggled OFF by the system administrator are automatically hidden.
          </p>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left p-4 w-48">Role</th>
                  <th className="text-left p-4">Active & Visible Permissions</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(ROLE_PERMISSIONS)
                  .filter(([role]) => role !== 'CREATOR')
                  .map(([role, perms]) => {
                    const visiblePerms = perms.includes('*')
                      ? ['* (Full Access)']
                      : perms.filter((p) => {
                          const feat = PERMISSION_FEATURE_MAP[p];
                          if (feat && !isFeatureEnabled(feat)) return false;
                          return true;
                        });

                    return (
                      <tr key={role} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="p-4 font-bold text-gray-900 dark:text-gray-100">
                          {ROLE_LABELS[role] || role}
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1.5">
                            {visiblePerms.map((p) => (
                              <span
                                key={p}
                                className="px-2 py-0.5 rounded text-xs bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300 font-mono"
                              >
                                {p}
                              </span>
                            ))}
                            {visiblePerms.length === 0 && (
                              <span className="text-xs text-gray-400 italic">
                                No active permissions (modules disabled)
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal
        isOpen={showAddYearModal}
        onClose={() => setShowAddYearModal(false)}
        title="Add New Academic Year"
        size="md"
      >
        <div className="space-y-4">
          <Input
            label="Academic Year Name *"
            placeholder="e.g. 2026-27"
            value={newYearForm.name}
            onChange={e => setNewYearForm(prev => ({ ...prev, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Start Date *"
              type="date"
              value={newYearForm.startDate}
              onChange={e => setNewYearForm(prev => ({ ...prev, startDate: e.target.value }))}
            />
            <Input
              label="End Date *"
              type="date"
              value={newYearForm.endDate}
              onChange={e => setNewYearForm(prev => ({ ...prev, endDate: e.target.value }))}
            />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={newYearForm.isCurrent}
              onChange={e => setNewYearForm(prev => ({ ...prev, isCurrent: e.target.checked }))}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            <span>Set as Active / Current Academic Year</span>
          </label>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => setShowAddYearModal(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={handleCreateAcademicYear} loading={savingYear}>
              Create Year
            </Button>
          </div>
        </div>
      </Modal>

      {/* Session Rollover Modal */}
      <Modal
        isOpen={showRolloverModal}
        onClose={() => setShowRolloverModal(false)}
        title="Session Rollover & Student Promotion Tool"
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            Promote enrolled students to their next class and optionally carry forward pending fee dues into the new academic session.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Source Session (Current Students)
              </label>
              <select
                value={sourceSessionId}
                onChange={(e) => {
                  setSourceSessionId(e.target.value);
                  setPreviewResult(null);
                }}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name} {y.isCurrent ? '★ (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Target Session (Promoted Session)
              </label>
              <select
                value={targetSessionId}
                onChange={(e) => {
                  setTargetSessionId(e.target.value);
                  setPreviewResult(null);
                }}
                className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                {academicYears.map((y) => (
                  <option key={y.id} value={y.id} disabled={y.id === sourceSessionId}>
                    {y.name} {y.isCurrent ? '★ (Active)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2 flex flex-col sm:flex-row gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={carryForwardDues}
                  onChange={(e) => setCarryForwardDues(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>Carry forward unpaid fee dues as opening balances in target session</span>
              </label>

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={setActiveAfterRollover}
                  onChange={(e) => setSetActiveAfterRollover(e.target.checked)}
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span>Set target session as ACTIVE upon successful rollover</span>
              </label>
            </div>

            <div className="sm:col-span-2 pt-1">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleGeneratePreview}
                loading={previewLoading}
                disabled={!sourceSessionId || !targetSessionId || sourceSessionId === targetSessionId}
              >
                <Sparkles className="w-4 h-4" /> Generate Rollover Preview
              </Button>
            </div>
          </div>

          {previewResult && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-center border border-gray-200 dark:border-gray-700">
                  <span className="text-xs text-gray-500">Eligible Students</span>
                  <p className="text-lg font-bold">{previewResult.totalStudents}</p>
                </div>
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg text-center border border-emerald-200 dark:border-emerald-800/40">
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">Promoted</span>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                    {previewResult.toPromoteCount}
                  </p>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-center border border-amber-200 dark:border-amber-800/40">
                  <span className="text-xs text-amber-600 dark:text-amber-400">Graduating (Alumni)</span>
                  <p className="text-lg font-bold text-amber-700 dark:text-amber-300">
                    {previewResult.toGraduateCount}
                  </p>
                </div>
                <div className="p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-lg text-center border border-indigo-200 dark:border-indigo-800/40">
                  <span className="text-xs text-indigo-600 dark:text-indigo-400">Dues Carry-Over</span>
                  <p className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
                    {formatCurrency(previewResult.totalPendingDuesPaise)}
                  </p>
                </div>
              </div>

              {/* Class progression chips */}
              <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-lg border border-gray-200 dark:border-gray-700">
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">Class Flow Breakdown:</p>
                <div className="flex flex-wrap gap-2">
                  {previewResult.classSummaries.map((cs, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs flex items-center gap-1.5"
                    >
                      <span className="font-semibold">{cs.fromClass}</span>
                      <ArrowRight className="w-3 h-3 text-primary-500" />
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{cs.toClass}</span>
                      <span className="text-[11px] font-mono text-gray-500 bg-gray-100 dark:bg-gray-800 px-1 rounded">
                        ({cs.count})
                      </span>
                    </span>
                  ))}
                </div>
              </div>

              {/* Student preview table */}
              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 border-b border-gray-200 dark:border-gray-700">
                    <tr>
                      <th className="text-left p-2.5">Student</th>
                      <th className="text-left p-2.5">Current Class</th>
                      <th className="text-left p-2.5">Target Class</th>
                      <th className="text-left p-2.5">Pending Dues</th>
                      <th className="text-left p-2.5">Action Override</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {previewResult.students.map((st) => {
                      const currentAction = studentOverrides[st.studentId] || st.action;
                      return (
                        <tr key={st.studentId}>
                          <td className="p-2.5">
                            <span className="font-semibold block">{st.name}</span>
                            <span className="text-[10px] text-gray-400 font-mono">{st.admissionNumber}</span>
                          </td>
                          <td className="p-2.5">{st.currentClassName}</td>
                          <td className="p-2.5 font-semibold text-emerald-600 dark:text-emerald-400">{st.nextClassName}</td>
                          <td className="p-2.5 font-mono">
                            {st.pendingDuePaise > 0 ? (
                              <span className="text-amber-600 font-bold">{formatCurrency(st.pendingDuePaise)}</span>
                            ) : (
                              <span className="text-gray-400">₹0</span>
                            )}
                          </td>
                          <td className="p-2.5">
                            <select
                              value={currentAction}
                              onChange={(e) =>
                                setStudentOverrides((prev) => ({
                                  ...prev,
                                  [st.studentId]: e.target.value as any,
                                }))
                              }
                              className="text-xs bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-1.5 py-1"
                            >
                              <option value="PROMOTE">Promote</option>
                              <option value="RETAIN">Retain</option>
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

              <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                <Button variant="secondary" onClick={() => setShowRolloverModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleExecuteRollover} loading={executingRollover}>
                  <CheckCircle2 className="w-4 h-4" /> Confirm & Execute Rollover
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
