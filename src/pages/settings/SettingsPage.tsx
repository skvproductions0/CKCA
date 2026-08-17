import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ROLE_LABELS, apiCall } from '../../utils/helpers';

export default function SettingsPage() {
  const { schoolSettings, refreshSettings } = useApp();
  const { success, error: showError } = useToast();
  const [activeTab, setActiveTab] = useState('school');
  const [form, setForm] = useState<Record<string, string>>({});
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [grading, setGrading] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

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

  const tabs = [
    { id: 'school', label: 'School Settings' },
    { id: 'grading', label: 'Grading System' },
    { id: 'users', label: 'User Management' },
  ];

  return (
    <div>
      <PageHeader title="Settings" subtitle="Configure school and system settings" />

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
    </div>
  );
}
