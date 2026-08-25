import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Search, RotateCcw, Trash2,
  Archive,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState, Pagination } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { TypeConfirmDialog, ConfirmDialog } from '../../components/ui/Modal';
import { formatDateTime, apiCall, getLocalFileUrl } from '../../utils/helpers';
import { Student } from '../../types';

export default function DeletedStudentsPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<Student | null>(null);
  const [deletingPermanently, setDeletingPermanently] = useState(false);
  const [showEmptyBinDialog, setShowEmptyBinDialog] = useState(false);
  const [emptyingBin, setEmptyingBin] = useState(false);

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => { loadDeletedStudents(); }, [search, classFilter, page]);

  const loadClasses = async () => {
    try {
      const data = await apiCall(() => window.api.classes.list());
      setClasses((data as { id: string; name: string }[]));
    } catch { /* ignore */ }
  };

  const loadDeletedStudents = async () => {
    setLoading(true);
    try {
      const result = await apiCall(() => window.api.students.listDeleted({
        search: search || undefined,
        classId: classFilter || undefined,
        page,
        limit: 20,
      })) as { students: Student[]; totalPages: number; total: number };
      setStudents(result.students || []);
      setTotalPages(result.totalPages || 1);
      setTotalCount(result.total || 0);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load deleted students');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (student: Student) => {
    setRestoringId(student.id);
    try {
      await apiCall(() => window.api.students.restore(student.id));
      success(`Student ${student.name} has been restored successfully!`);
      loadDeletedStudents();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to restore student');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    setDeletingPermanently(true);
    try {
      await apiCall(() => window.api.students.permanentDelete(permanentDeleteTarget.id));
      success(`Student ${permanentDeleteTarget.name} was permanently deleted.`);
      setPermanentDeleteTarget(null);
      loadDeletedStudents();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to permanently delete student');
    } finally {
      setDeletingPermanently(false);
    }
  };

  const handleEmptyRecycleBin = async () => {
    setEmptyingBin(true);
    try {
      const result = await apiCall(() => window.api.students.emptyRecycleBin()) as { count: number };
      success(`Recycle bin emptied. ${result.count || 0} student records deleted permanently.`);
      setShowEmptyBinDialog(false);
      loadDeletedStudents();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to empty recycle bin');
    } finally {
      setEmptyingBin(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Deleted Students (Recycle Bin)"
        subtitle="View soft-deleted students, restore them back to active list, or delete permanently"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate('/students')}>
              <ArrowLeft className="w-4 h-4" /> Back to Students
            </Button>
            {students.length > 0 && (
              <Button
                variant="danger"
                onClick={() => setShowEmptyBinDialog(true)}
              >
                <Trash2 className="w-4 h-4" /> Empty Recycle Bin
              </Button>
            )}
          </div>
        }
      />

      {/* Info banner */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 mb-6 flex items-start gap-3">
        <Archive className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-amber-800 dark:text-amber-300">
          <p className="font-semibold">Soft-Delete Protection</p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            Students deleted from the main list are saved here. You can restore a student anytime with all their fee history, attendance, and exam records intact.
          </p>
        </div>
      </div>

      {/* Search & filters */}
      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div className="sm:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="input pl-10"
              placeholder="Search deleted by name, admission no, phone..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <Select
            placeholder="All Classes"
            options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))}
            value={classFilter}
            onChange={e => { setClassFilter(e.target.value); setPage(1); }}
          />
          <div className="flex items-center justify-end">
            <span className="text-xs text-gray-500 font-medium">
              Total in Bin: <strong className="text-gray-900 dark:text-white">{totalCount}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <LoadingSpinner />
        ) : students.length === 0 ? (
          <EmptyState
            title="Recycle Bin is empty"
            description="There are no deleted students in the Recycle Bin."
            icon={<Archive className="w-12 h-12 text-gray-400" />}
            action={
              <Button variant="secondary" onClick={() => navigate('/students')}>
                <ArrowLeft className="w-4 h-4" /> Go to Students
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                  <tr>
                    <th className="text-left p-4 font-medium">Admission No</th>
                    <th className="text-left p-4 font-medium">Student</th>
                    <th className="text-left p-4 font-medium">Class / Section</th>
                    <th className="text-left p-4 font-medium">Phone</th>
                    <th className="text-left p-4 font-medium">Deleted Date</th>
                    <th className="text-right p-4 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map((student) => (
                    <tr
                      key={student.id}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                    >
                      <td className="p-4 font-mono text-xs text-gray-500">
                        {student.admissionNumber}
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0 flex items-center justify-center border border-gray-200 dark:border-gray-700">
                            {student.photoPath ? (
                              <img
                                src={getLocalFileUrl(student.photoPath)}
                                alt={student.name}
                                className="w-full h-full object-cover"
                                onError={(e) => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                              />
                            ) : (
                              <span className="text-xs font-bold text-gray-600 dark:text-gray-300">
                                {student.name.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {student.name}
                            </p>
                            <p className="text-xs text-gray-500">{student.fatherName || 'No parent name'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {student.class?.name ? (
                          <span>Class {student.class.name} {student.section?.name ? `(${student.section.name})` : ''}</span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-400">
                        {student.phone || student.fatherMobile || '-'}
                      </td>
                      <td className="p-4">
                        <span className="text-xs text-gray-500">
                          {student.deletedAt ? formatDateTime(student.deletedAt) : 'Recently deleted'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleRestore(student)}
                            disabled={restoringId === student.id}
                            className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            {restoringId === student.id ? 'Restoring...' : 'Restore'}
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setPermanentDeleteTarget(student)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete Permanently
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 border-t border-gray-100 dark:border-gray-800">
              <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
          </>
        )}
      </div>

      {/* Permanent Delete confirmation dialog */}
      <TypeConfirmDialog
        isOpen={!!permanentDeleteTarget}
        onClose={() => setPermanentDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete Student"
        message={`This will PERMANENTLY erase ${permanentDeleteTarget?.name}'s record including all fee records, attendance, and exam results. This action is irreversible.`}
        requiredText={permanentDeleteTarget?.name ?? ''}
        confirmText="Permanently Delete"
        loading={deletingPermanently}
      />

      {/* Empty Recycle Bin Dialog */}
      <ConfirmDialog
        isOpen={showEmptyBinDialog}
        onClose={() => setShowEmptyBinDialog(false)}
        onConfirm={handleEmptyRecycleBin}
        title="Empty Recycle Bin?"
        message={`Are you sure you want to permanently delete all ${totalCount} students in the Recycle Bin? This action cannot be undone.`}
        confirmText="Yes, Empty Bin"
        variant="danger"
        loading={emptyingBin}
      />
    </div>
  );
}
