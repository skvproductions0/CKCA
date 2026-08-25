import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, MoreVertical, Eye, Trash2, Users, Archive } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState, Badge, Pagination } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { TypeConfirmDialog } from '../../components/ui/Modal';
import { formatCurrency, apiCall, getLocalFileUrl } from '../../utils/helpers';
import { Student } from '../../types';

/* ── 3-dot action menu per row ─────────────────────────────────────────── */
function RowMenu({ onView, onDelete }: {
  onView: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={e => { e.stopPropagation(); setOpen(v => !v); }}
        className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        title="Actions"
      >
        <MoreVertical className="w-4 h-4 text-gray-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-8 z-30 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            onClick={() => { setOpen(false); onView(); }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-blue-500" />
            View Details
          </button>
          <div className="h-px bg-gray-100 dark:bg-gray-700 mx-2 my-0.5" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function StudentsPage() {
  const { academicYear } = useApp();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [feeFilter, setFeeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [deleteStudent, setDeleteStudent] = useState<Student | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => { loadStudents(); }, [search, classFilter, feeFilter, statusFilter, page, academicYear?.id]);

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
        search,
        classId: classFilter || undefined,
        feeStatus: feeFilter || undefined,
        status: statusFilter || undefined,
        academicYearId: academicYear?.id,
        page,
        limit: 20,
      })) as { students: Student[]; totalPages: number };
      setStudents(result.students);
      setTotalPages(result.totalPages);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteStudent) return;
    setDeleting(true);
    try {
      await apiCall(() => window.api.students.archive(deleteStudent.id));
      success('Student moved to Recycle Bin successfully');
      setDeleteStudent(null);
      loadStudents();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setDeleting(false);
    }
  };

  const renderStatusBadge = (status?: string) => {
    switch (status) {
      case 'ACTIVE':
        return <Badge variant="success">Active</Badge>;
      case 'INACTIVE':
        return <Badge variant="danger">Inactive</Badge>;
      case 'TRANSFERRED':
        return <Badge variant="warning">Transferred</Badge>;
      case 'GRADUATED':
        return <Badge variant="info">Graduated</Badge>;
      default:
        return <Badge variant="gray">{status || 'Active'}</Badge>;
    }
  };

  return (
    <div>
      <PageHeader
        title="Students"
        subtitle="Manage student records"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/students/deleted')}>
              <Archive className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              Recycle Bin
            </Button>
            <Button onClick={() => navigate('/students/add')}>
              <Plus className="w-4 h-4" /> Add Student
            </Button>
          </div>
        }
      />

      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Search by name, admission no, phone..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select placeholder="All Classes" options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))} value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(1); }} />
          <Select placeholder="Fee Status" options={[{ value: 'paid', label: 'Paid' }, { value: 'partial', label: 'Partial' }, { value: 'pending', label: 'Pending' }]} value={feeFilter} onChange={e => { setFeeFilter(e.target.value); setPage(1); }} />
          <Select
            placeholder="All Statuses"
            options={[
              { value: 'ACTIVE', label: 'Active' },
              { value: 'INACTIVE', label: 'Inactive' },
              { value: 'TRANSFERRED', label: 'Transferred' },
              { value: 'GRADUATED', label: 'Graduated' },
            ]}
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner /> : students.length === 0 ? (
          <EmptyState title="No students found" description="Add your first student or clear filters" icon={<Users className="w-12 h-12" />} action={<Button onClick={() => navigate('/students/add')}><Plus className="w-4 h-4" /> Add Student</Button>} />
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
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/50 flex-shrink-0 flex items-center justify-center border border-primary-200 dark:border-primary-800">
                            {student.photoPath ? (
                              <img src={getLocalFileUrl(student.photoPath)} alt={student.name} className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }} />
                            ) : (
                              <span className="text-xs font-bold text-primary-700 dark:text-primary-300">{student.name.charAt(0)}</span>
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.fatherName}</p>
                          </div>
                        </div>
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
                      <td className="p-4">{renderStatusBadge(student.status)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-end">
                          <RowMenu
                            onView={() => navigate(`/students/${student.id}`)}
                            onDelete={() => setDeleteStudent(student)}
                          />
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

      {/* Type-to-confirm delete dialog */}
      <TypeConfirmDialog
        isOpen={!!deleteStudent}
        onClose={() => setDeleteStudent(null)}
        onConfirm={handleDelete}
        title="Move Student to Recycle Bin"
        message={`This will remove ${deleteStudent?.name} from the active student list and move them to the Recycle Bin. You can restore this student anytime without losing any fee or academic history.`}
        requiredText={deleteStudent?.name ?? ''}
        confirmText="Move to Recycle Bin"
        loading={deleting}
      />
    </div>
  );
}
