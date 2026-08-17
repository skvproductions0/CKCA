import { useState, useEffect } from 'react';
import { Plus, Search, Edit } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState, Badge, Pagination } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { apiCall } from '../../utils/helpers';

export default function TeachersPage() {
  const { success, error: showError } = useToast();
  const [teachers, setTeachers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', qualification: '', subject: '', joiningDate: '' });

  useEffect(() => { loadTeachers(); }, [search, page]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const result = await apiCall(() => window.api.teachers.list({ search, page, limit: 20 })) as { teachers: Record<string, unknown>[]; totalPages: number };
      setTeachers(result.teachers);
      setTotalPages(result.totalPages);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!form.name) return;
    try {
      await apiCall(() => window.api.teachers.create({
        ...form,
        joiningDate: form.joiningDate ? new Date(form.joiningDate) : undefined,
        status: 'ACTIVE',
      }));
      success('Teacher added');
      setShowAdd(false);
      setForm({ name: '', phone: '', email: '', qualification: '', subject: '', joiningDate: '' });
      loadTeachers();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add teacher');
    }
  };

  return (
    <div>
      <PageHeader title="Teachers" subtitle="Manage teacher records" actions={<Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Teacher</Button>} />

      <div className="card p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Search teachers..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner /> : teachers.length === 0 ? (
          <EmptyState title="No teachers found" action={<Button onClick={() => setShowAdd(true)}><Plus className="w-4 h-4" /> Add Teacher</Button>} />
        ) : (
          <>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left p-4">Employee ID</th>
                  <th className="text-left p-4">Name</th>
                  <th className="text-left p-4">Subject</th>
                  <th className="text-left p-4">Phone</th>
                  <th className="text-left p-4">Status</th>
                  <th className="text-right p-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teachers.map(t => (
                  <tr key={t.id as string} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-4 font-mono text-xs">{t.employeeId as string}</td>
                    <td className="p-4 font-medium">{t.name as string}</td>
                    <td className="p-4">{t.subject as string || '-'}</td>
                    <td className="p-4">{t.phone as string || '-'}</td>
                    <td className="p-4"><Badge variant={t.status === 'ACTIVE' ? 'success' : 'gray'}>{t.status as string}</Badge></td>
                    <td className="p-4 text-right"><button className="p-1.5 rounded hover:bg-gray-100"><Edit className="w-4 h-4" /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="Add Teacher" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Name *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
          <Input label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
          <Input label="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
          <Input label="Qualification" value={form.qualification} onChange={e => setForm({ ...form, qualification: e.target.value })} />
          <Input label="Subject" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} />
          <Input label="Joining Date" type="date" value={form.joiningDate} onChange={e => setForm({ ...form, joiningDate: e.target.value })} />
        </div>
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Button><Button onClick={handleAdd}>Add Teacher</Button></div>
      </Modal>
    </div>
  );
}
