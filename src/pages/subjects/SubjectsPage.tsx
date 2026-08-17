import { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { apiCall } from '../../utils/helpers';

export default function SubjectsPage() {
  const { success, error: showError } = useToast();
  const [subjects, setSubjects] = useState<Record<string, unknown>[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', classId: '', maxMarks: '100', passingMarks: '40', teacherId: '' });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sub, cls, tch] = await Promise.all([
        apiCall(() => window.api.subjects.list()),
        apiCall(() => window.api.classes.list()),
        apiCall(() => window.api.teachers.list({ limit: 100 })),
      ]);
      setSubjects(sub as Record<string, unknown>[]);
      setClasses(cls as typeof classes);
      setTeachers((tch as { teachers: typeof teachers }).teachers);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.name || !form.code || !form.classId) return;
    try {
      await apiCall(() => window.api.subjects.create({
        name: form.name,
        code: form.code,
        classId: form.classId,
        maxMarks: parseInt(form.maxMarks),
        passingMarks: parseInt(form.passingMarks),
        teacherId: form.teacherId || undefined,
      }));
      success('Subject added');
      setShowAdd(false);
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Subjects" subtitle="Manage subjects by class" actions={<Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Subject</Button>} />

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="text-left p-4">Code</th>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Class</th>
              <th className="text-left p-4">Max Marks</th>
              <th className="text-left p-4">Teacher</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map(s => {
              const cls = s.class as { name: string };
              const teacher = s.teacher as { name: string } | null;
              return (
                <tr key={s.id as string} className="border-t border-gray-100 dark:border-gray-800">
                  <td className="p-4 font-mono">{s.code as string}</td>
                  <td className="p-4 font-medium">{s.name as string}</td>
                  <td className="p-4">Class {cls?.name}</td>
                  <td className="p-4">{s.maxMarks as number}</td>
                  <td className="p-4">{teacher?.name || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Subject">
        <div className="space-y-4">
          <Input label="Subject Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Subject Code" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} />
          <Select label="Class" options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))} placeholder="Select class" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Max Marks" type="number" value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })} />
            <Input label="Passing Marks" type="number" value={form.passingMarks} onChange={e => setForm({ ...form, passingMarks: e.target.value })} />
          </div>
          <Select label="Teacher" options={teachers.map(t => ({ value: t.id, label: t.name }))} placeholder="Optional" value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Add</Button></div>
      </Modal>
    </div>
  );
}
