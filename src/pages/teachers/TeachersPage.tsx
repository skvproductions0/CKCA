import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit, Trash2, User, Phone, Mail, GraduationCap } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState, Badge, Pagination } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Modal';
import { apiCall, getLocalFileUrl } from '../../utils/helpers';

interface TeacherItem {
  id: string;
  employeeId: string;
  name: string;
  gender?: string | null;
  subject?: string | null;
  qualification?: string | null;
  phone?: string | null;
  email?: string | null;
  status: string;
  photoPath?: string | null;
}

export default function TeachersPage() {
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deletedCount, setDeletedCount] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadTeachers();
    loadDeletedCount();
  }, [search, page]);

  const loadTeachers = async () => {
    setLoading(true);
    try {
      const result = (await apiCall(() =>
        window.api.teachers.list({ search, page, limit: 20 })
      )) as { teachers: TeacherItem[]; totalPages: number };
      setTeachers(result.teachers || []);
      setTotalPages(result.totalPages || 1);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load teachers');
    } finally {
      setLoading(false);
    }
  };

  const loadDeletedCount = async () => {
    try {
      const result = (await apiCall(() =>
        window.api.teachers.listDeleted({ limit: 1 })
      )) as { total: number };
      setDeletedCount(result.total || 0);
    } catch {
      // ignore
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await apiCall(() => window.api.teachers.archive(deleteId));
      success('Teacher moved to Recycle Bin');
      setDeleteId(null);
      loadTeachers();
      loadDeletedCount();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete teacher');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Teachers"
        subtitle="Manage faculty & teacher records"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => navigate('/teachers/deleted')}
              className="flex items-center gap-1.5"
            >
              <Trash2 className="w-4 h-4 text-gray-500" />
              Recycle Bin
              {deletedCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs font-semibold rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300">
                  {deletedCount}
                </span>
              )}
            </Button>
            <Button onClick={() => navigate('/teachers/add')}>
              <Plus className="w-4 h-4 mr-1.5" /> Add Teacher
            </Button>
          </div>
        }
      />

      {/* Search Filter */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-10 w-full"
            placeholder="Search teachers by name, employee ID, phone, or subject..."
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

      {/* Responsive Teachers Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12">
            <LoadingSpinner message="Loading teachers..." />
          </div>
        ) : teachers.length === 0 ? (
          <EmptyState
            title="No teachers found"
            description={search ? 'No teachers match your search query.' : 'Add your first teacher to get started.'}
            action={
              <Button onClick={() => navigate('/teachers/add')}>
                <Plus className="w-4 h-4 mr-1.5" /> Add Teacher
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
                      Status
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
                          <div className="w-10 h-10 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/60 flex items-center justify-center flex-shrink-0 border border-primary-200 dark:border-primary-800">
                            {t.photoPath ? (
                              <img
                                src={getLocalFileUrl(t.photoPath)}
                                alt={t.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white">{t.name}</p>
                            <span className="font-mono text-xs text-gray-400">{t.employeeId}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className="font-medium text-gray-800 dark:text-gray-200">
                          {t.subject || '-'}
                        </span>
                      </td>
                      <td className="p-4 text-gray-600 dark:text-gray-300">
                        {t.qualification ? (
                          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
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
                      <td className="p-4">
                        <Badge
                          variant={
                            t.status === 'ACTIVE'
                              ? 'success'
                              : t.status === 'ON_LEAVE'
                              ? 'warning'
                              : 'gray'
                          }
                        >
                          {t.status}
                        </Badge>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end items-center gap-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/teachers/${t.id}/edit`)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                            title="Edit Teacher"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(t.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Delete Teacher"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

      {/* Delete Confirmation Modal */}
      <ConfirmDialog
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="Move Teacher to Recycle Bin?"
        message="Are you sure you want to remove this teacher? The teacher's record will be moved to the Recycle Bin. You can restore or permanently delete them later."
        confirmText="Move to Recycle Bin"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
