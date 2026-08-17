import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Edit, Archive, Users } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState, Badge, Pagination } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { ConfirmDialog } from '../../components/ui/Modal';
import { formatCurrency, GENDER_OPTIONS, apiCall } from '../../utils/helpers';
import { Student } from '../../types';

export default function StudentsPage() {
  const { academicYear } = useApp();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [genderFilter, setGenderFilter] = useState('');
  const [feeFilter, setFeeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [archiveId, setArchiveId] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => { loadStudents(); }, [search, classFilter, genderFilter, feeFilter, page, academicYear?.id]);

  const loadClasses = async () => {
    try {
      const data = await apiCall(() => window.api.classes.list());
      setClasses((data as { id: string; name: string }[]));
    } catch { /* ignore */ }
  };

  const loadStudents = async () => {
    setLoading(true);
    try {
      const result = await apiCall(() => window.api.students.list({
        search, classId: classFilter || undefined, gender: genderFilter || undefined,
        feeStatus: feeFilter || undefined, academicYearId: academicYear?.id,
        page, limit: 20,
      })) as { students: Student[]; totalPages: number };
      setStudents(result.students);
      setTotalPages(result.totalPages);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    if (!archiveId) return;
    setArchiving(true);
    try {
      await apiCall(() => window.api.students.archive(archiveId));
      success('Student archived successfully');
      setArchiveId(null);
      loadStudents();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to archive');
    } finally {
      setArchiving(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Manage student records"
        actions={<Button onClick={() => navigate('/students/add')}><Plus className="w-4 h-4" /> Add Student</Button>}
      />

      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Search by name, admission no, phone..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select placeholder="All Classes" options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))} value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1); }} />
          <Select placeholder="All Genders" options={GENDER_OPTIONS} value={genderFilter} onChange={e => { setGenderFilter(e.target.value); setPage(1); }} />
          <Select placeholder="Fee Status" options={[{ value: 'paid', label: 'Paid' }, { value: 'partial', label: 'Partial' }, { value: 'pending', label: 'Pending' }]} value={feeFilter} onChange={e => { setFeeFilter(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner /> : students.length === 0 ? (
          <EmptyState title="No students found" description="Add your first student to get started" icon={<Users className="w-12 h-12" />} action={<Button onClick={() => navigate('/students/add')}><Plus className="w-4 h-4" /> Add Student</Button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left p-4 font-medium">Admission No</th>
                    <th className="text-left p-4 font-medium">Student</th>
                    <th className="text-left p-4 font-medium">Class</th>
                    <th className="text-left p-4 font-medium">Section</th>
                    <th className="text-left p-4 font-medium">Phone</th>
                    <th className="text-left p-4 font-medium">Fees</th>
                    <th className="text-left p-4 font-medium">Status</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => (
                    <tr key={student.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="p-4 font-mono text-xs">{student.admissionNumber}</td>
                      <td className="p-4">
                        <p className="font-medium">{student.name}</p>
                        <p className="text-xs text-gray-500">{student.fatherName}</p>
                      </td>
                      <td className="p-4">{student.class?.name ? `Class ${student.class.name}` : '-'}</td>
                      <td className="p-4">{student.section?.name || '-'}</td>
                      <td className="p-4">{student.phone || '-'}</td>
                      <td className="p-4">
                        {(student.pendingFeePaise || 0) > 0 ? (
                          <Badge variant="warning">{formatCurrency(student.pendingFeePaise || 0)} due</Badge>
                        ) : (
                          <Badge variant="success">Paid</Badge>
                        )}
                      </td>
                      <td className="p-4"><Badge variant={student.status === 'ACTIVE' ? 'success' : 'gray'}>{student.status}</Badge></td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => navigate(`/students/${student.id}`)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="View"><Eye className="w-4 h-4" /></button>
                          <button onClick={() => navigate(`/students/${student.id}/edit`)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700" title="Edit"><Edit className="w-4 h-4" /></button>
                          <button onClick={() => setArchiveId(student.id)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Archive"><Archive className="w-4 h-4" /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!archiveId}
        onClose={() => setArchiveId(null)}
        onConfirm={handleArchive}
        title="Archive Student"
        message="Are you sure you want to archive this student? This action can be reversed by an administrator."
        loading={archiving}
      />
    </div>
  );
}
