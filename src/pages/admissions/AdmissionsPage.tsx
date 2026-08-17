import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, Badge } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import NewAdmissionWizard from './NewAdmissionWizard';
import { formatDate, apiCall } from '../../utils/helpers';

export default function AdmissionsPage() {
  const { academicYear } = useApp();
  const { success, error: showError } = useToast();
  const [admissions, setAdmissions] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => { loadData(); }, [academicYear?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const adm = await apiCall(() => window.api.admissions.list({ academicYearId: academicYear?.id }));
      setAdmissions((adm as { admissions: Record<string, unknown>[] }).admissions);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await apiCall(() => window.api.admissions.approve(id));
      success('Admission approved and student enrolled');
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to approve');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Admissions" subtitle="Manage admission applications" actions={<Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> New Admission</Button>} />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left p-4">Admission No</th>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Phone</th>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Status</th>
              <th className="text-right p-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {admissions.map(a => (
              <tr key={a.id as string} className="border-t border-gray-100 dark:border-gray-800">
                <td className="p-4 font-mono text-xs">{a.admissionNumber as string}</td>
                <td className="p-4 font-medium">{a.name as string}</td>
                <td className="p-4">{a.phone as string || '-'}</td>
                <td className="p-4">{formatDate(a.admissionDate as string)}</td>
                <td className="p-4"><Badge variant={a.status === 'ENROLLED' ? 'success' : a.status === 'PENDING' ? 'warning' : 'info'}>{a.status as string}</Badge></td>
                <td className="p-4 text-right">
                  {a.status === 'PENDING' && <Button size="sm" onClick={() => handleApprove(a.id as string)}>Approve</Button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {admissions.length === 0 && <p className="p-8 text-center text-gray-500">No admissions yet</p>}
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="New Admission" size="xl">
        <NewAdmissionWizard onClose={() => setShowAdd(false)} onSuccess={loadData} />
      </Modal>
    </div>
  );
}
