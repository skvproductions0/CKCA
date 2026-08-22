import { useState, useEffect } from 'react';
import { Plus, CheckCircle2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, Badge } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Modal } from '../../components/ui/Modal';
import { ROLE_LABELS, formatDate, apiCall } from '../../utils/helpers';

export default function SettingsPage() {
  const { schoolSettings, academicYears, setAcademicYear, refreshSettings } = useApp();
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

  const tabs = [
    { id: 'school', label: 'School Settings' },
    { id: 'academicYears', label: 'Academic Years' },
    { id: 'grading', label: 'Grading System' },
    { id: 'users', label: 'User Management' },
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
          <div className="flex justify-between items-center">
            <p className="text-sm text-gray-500">
              Manage academic sessions for student admissions, classes, examinations, and fee collection.
            </p>
            <Button onClick={() => setShowAddYearModal(true)}>
              <Plus className="w-4 h-4" /> Add Academic Year
            </Button>
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
    </div>
  );
}
