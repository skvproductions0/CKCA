import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatDate, apiCall } from '../../utils/helpers';

export default function ExaminationsPage() {
  const { academicYear } = useApp();
  const { success, error: showError } = useToast();
  const [exams, setExams] = useState<Record<string, unknown>[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', classId: '', startDate: '', endDate: '' });

  useEffect(() => { loadData(); }, [academicYear?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [ex, cls] = await Promise.all([
        apiCall(() => window.api.exams.list(academicYear?.id)),
        apiCall(() => window.api.classes.list()),
      ]);
      setExams(ex as Record<string, unknown>[]);
      setClasses(cls as typeof classes);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.name || !form.classId || !academicYear?.id) return;
    try {
      await apiCall(() => window.api.exams.create({
        name: form.name,
        classId: form.classId,
        academicYearId: academicYear.id,
        startDate: new Date(form.startDate),
        endDate: new Date(form.endDate),
      }));
      success('Exam created');
      setShowAdd(false);
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Examinations" subtitle="Manage exams and schedules" actions={<Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Create Exam</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {exams.map(ex => {
          const cls = ex.class as { name: string };
          return (
            <div key={ex.id as string} className="card p-5">
              <h3 className="font-bold text-lg">{ex.name as string}</h3>
              <p className="text-sm text-gray-500 mt-1">Class {cls?.name}</p>
              <p className="text-sm mt-3">{formatDate(ex.startDate as string)} — {formatDate(ex.endDate as string)}</p>
            </div>
          );
        })}
        {exams.length === 0 && <p className="text-gray-500 col-span-full text-center py-8">No examinations created yet</p>}
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Create Examination">
        <div className="space-y-4">
          <Input label="Exam Name" placeholder="e.g. Half Yearly" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Select label="Class" options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))} placeholder="Select class" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} />
          <Input label="Start Date" type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} />
          <Input label="End Date" type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Create</Button></div>
      </Modal>
    </div>
  );
}
