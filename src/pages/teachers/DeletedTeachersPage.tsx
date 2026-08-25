import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Search,
  RotateCcw,
  Trash2,
  User,
  GraduationCap,
  Phone,
  Mail,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState, Pagination } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { TypeConfirmDialog, ConfirmDialog } from '../../components/ui/Modal';
import { formatDateTime, apiCall, getLocalFileUrl } from '../../utils/helpers';

interface TeacherItem {
  id: string;
  employeeId: string;
  name: string;
  subject?: string | null;
  qualification?: string | null;
  phone?: string | null;
  email?: string | null;
  photoPath?: string | null;
  deletedAt?: string | null;
}

export default function DeletedTeachersPage() {
  const navigate = useNavigate();
  const { success, error: showError } = useToast();
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<TeacherItem | null>(null);
  const [deletingPermanently, setDeletingPermanently] = useState(false);
  const [showEmptyBinDialog, setShowEmptyBinDialog] = useState(false);
  const [emptyingBin, setEmptyingBin] = useState(false);

  useEffect(() => {
    loadDeletedTeachers();
  }, [search, page]);

  const loadDeletedTeachers = async () => {
    setLoading(true);
    try {
      const result = (await apiCall(() =>
        window.api.teachers.listDeleted({
          search: search || undefined,
          page,
          limit: 20,
        })
      )) as { teachers: TeacherItem[]; totalPages: number; total: number };
      setTeachers(result.teachers || []);
      setTotalPages(result.totalPages || 1);
      setTotalCount(result.total || 0);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load deleted teachers');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (teacher: TeacherItem) => {
    setRestoringId(teacher.id);
    try {
      await apiCall(() => window.api.teachers.restore(teacher.id));
      success(`Teacher ${teacher.name} has been restored successfully!`);
      loadDeletedTeachers();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to restore teacher');
    } finally {
      setRestoringId(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!permanentDeleteTarget) return;
    setDeletingPermanently(true);
    try {
      await apiCall(() => window.api.teachers.permanentDelete(permanentDeleteTarget.id));
      success(`Teacher ${permanentDeleteTarget.name} was permanently deleted.`);
      setPermanentDeleteTarget(null);
      loadDeletedTeachers();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to permanently delete teacher');
    } finally {
      setDeletingPermanently(false);
    }
  };

  const handleEmptyRecycleBin = async () => {
    setEmptyingBin(true);
    try {
      const result = (await apiCall(() => window.api.teachers.emptyRecycleBin())) as {
        count: number;
      };
      success(`Recycle bin emptied. ${result.count || 0} teacher records deleted permanently.`);
      setShowEmptyBinDialog(false);
      loadDeletedTeachers();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to empty recycle bin');
    } finally {
      setEmptyingBin(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate('/teachers')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <PageHeader
              title="Recycle Bin — Deleted Teachers"
              subtitle={
                totalCount > 0
                  ? `${totalCount} archived teacher record${totalCount > 1 ? 's' : ''} in recycle bin`
                  : 'No deleted teachers in recycle bin'
              }
            />
          </div>
        </div>

        {totalCount > 0 && (
          <Button
            variant="danger"
            onClick={() => setShowEmptyBinDialog(true)}
            className="flex items-center gap-2 self-start sm:self-auto"
          >
            <Trash2 className="w-4 h-4" /> Empty Recycle Bin
          </Button>
        )}
      </div>

      {/* ── Search Bar ─────────────────────────────────────────────────────── */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-10 w-full"
            placeholder="Search deleted teachers by name, employee ID, phone, or subject..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* ── Table Card ────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12">
            <LoadingSpinner message="Loading deleted teachers..." />
          </div>
        ) : teachers.length === 0 ? (
          <EmptyState
            title="Recycle bin is empty"
            description={
              search
                ? 'No deleted teachers matched your search query.'
                : 'Deleted teacher records will appear here before permanent removal.'
            }
            action={
              <Button variant="secondary" onClick={() => navigate('/teachers')}>
                Back to Teachers
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[760px]">
                <thead className="bg-gray-50 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800">
                  <tr>
                    <th className="text-left p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Teacher & Emp ID
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Subject / Department
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Qualification
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Deleted At
                    </th>
                    <th className="text-right p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {teachers.map((t) => (
                    <tr
                      key={t.id}
                      className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 border border-gray-200 dark:border-gray-700">
                            {t.photoPath ? (
                              <img
                                src={getLocalFileUrl(t.photoPath)}
                                alt={t.name}
                                className="w-full h-full object-cover grayscale"
                              />
                            ) : (
                              <User className="w-5 h-5 text-gray-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white line-through decoration-gray-400">
                              {t.name}
                            </p>
                            <span className="font-mono text-xs text-gray-400">{t.employeeId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-300">
                        {t.subject || '-'}
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-300">
                        {t.qualification ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-medium">
                            <GraduationCap className="w-3 h-3" /> {t.qualification}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-300">
                        <div className="space-y-0.5 text-xs">
                          {t.phone && (
                            <p className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                              <Phone className="w-3 h-3 text-gray-400" /> {t.phone}
                            </p>
                          )}
                          {t.email && (
                            <p className="flex items-center gap-1 text-gray-500">
                              <Mail className="w-3 h-3 text-gray-400" /> {t.email}
                            </p>
                          )}
                          {!t.phone && !t.email && <span className="text-gray-400">-</span>}
                        </div>
                      </td>
                      <td className="p-4 text-xs text-gray-500">
                        {t.deletedAt ? formatDateTime(t.deletedAt) : 'Archived'}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end items-center gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleRestore(t)}
                            loading={restoringId === t.id}
                            className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800"
                          >
                            <RotateCcw className="w-3.5 h-3.5" /> Restore
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => setPermanentDeleteTarget(t)}
                            className="flex items-center gap-1 text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-800">
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Permanent Delete Modal ────────────────────────────────────────── */}
      <TypeConfirmDialog
        isOpen={!!permanentDeleteTarget}
        onClose={() => setPermanentDeleteTarget(null)}
        onConfirm={handlePermanentDelete}
        title="Permanently Delete Teacher"
        message={`This action will PERMANENTLY remove teacher ${permanentDeleteTarget?.name} (${permanentDeleteTarget?.employeeId}) and all attached documents from the database. This CANNOT be undone.`}
        requiredText={permanentDeleteTarget?.name || 'DELETE'}
        loading={deletingPermanently}
      />

      {/* ── Empty Recycle Bin Modal ───────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={showEmptyBinDialog}
        onClose={() => setShowEmptyBinDialog(false)}
        onConfirm={handleEmptyRecycleBin}
        title="Empty Teacher Recycle Bin?"
        message={`Are you sure you want to permanently delete all ${totalCount} teacher record(s) currently in the recycle bin? This action cannot be reversed.`}
        confirmText="Yes, Empty Recycle Bin"
        variant="danger"
        loading={emptyingBin}
      />
    </div>
  );
}
