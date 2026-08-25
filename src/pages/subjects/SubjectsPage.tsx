import { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  BookOpen,
  Search,
  Edit,
  Trash2,
  GraduationCap,
  Award,
  Layers,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { apiCall, getLocalFileUrl } from '../../utils/helpers';

interface ClassItem {
  id: string;
  name: string;
}

interface TeacherItem {
  id: string;
  name: string;
  photoPath?: string | null;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string;
  classId: string;
  maxMarks: number;
  passingMarks: number;
  teacherId?: string | null;
  class?: ClassItem;
  teacher?: TeacherItem | null;
}

const COMMON_SUBJECT_SUGGESTIONS = [
  { name: 'Mathematics', code: 'MATH' },
  { name: 'English', code: 'ENG' },
  { name: 'Hindi', code: 'HIN' },
  { name: 'Science', code: 'SCI' },
  { name: 'Social Science', code: 'SST' },
  { name: 'Physics', code: 'PHY' },
  { name: 'Chemistry', code: 'CHEM' },
  { name: 'Biology', code: 'BIO' },
  { name: 'Computer Science', code: 'CS' },
  { name: 'Sanskrit', code: 'SKT' },
  { name: 'General Knowledge', code: 'GK' },
  { name: 'Environmental Studies', code: 'EVS' },
  { name: 'Physical Education', code: 'PED' },
  { name: 'Art & Craft', code: 'ART' },
  { name: 'Music', code: 'MUS' },
];

export default function SubjectsPage() {
  const { success, error: showError } = useToast();
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedClassId, setSelectedClassId] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<SubjectItem | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete State
  const [deleteTarget, setDeleteTarget] = useState<SubjectItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    code: '',
    classId: '',
    maxMarks: '100',
    passingMarks: '40',
    teacherId: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sub, cls, tch] = await Promise.all([
        apiCall(() => window.api.subjects.list()),
        apiCall(() => window.api.classes.list()),
        apiCall(() => window.api.teachers.list({ limit: 100 })),
      ]);
      setSubjects((sub as SubjectItem[]) || []);
      setClasses((cls as ClassItem[]) || []);
      setTeachers(((tch as { teachers: TeacherItem[] })?.teachers) || []);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load subjects');
    } finally {
      setLoading(false);
    }
  };

  const openAddModal = () => {
    setEditItem(null);
    setForm({
      name: '',
      code: '',
      classId: selectedClassId !== 'ALL' ? selectedClassId : classes[0]?.id || '',
      maxMarks: '100',
      passingMarks: '40',
      teacherId: '',
    });
    setShowModal(true);
  };

  const openEditModal = (item: SubjectItem) => {
    setEditItem(item);
    setForm({
      name: item.name,
      code: item.code,
      classId: item.classId,
      maxMarks: String(item.maxMarks || 100),
      passingMarks: String(item.passingMarks || 40),
      teacherId: item.teacherId || '',
    });
    setShowModal(true);
  };

  const handleNameSelect = (name: string) => {
    const found = COMMON_SUBJECT_SUGGESTIONS.find(
      (s) => s.name.toLowerCase() === name.toLowerCase()
    );
    setForm((prev) => ({
      ...prev,
      name,
      code: prev.code ? prev.code : found?.code || name.slice(0, 4).toUpperCase(),
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !form.code.trim() || !form.classId) {
      showError('Please enter Subject Name, Subject Code, and select a Class');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toUpperCase(),
        classId: form.classId,
        maxMarks: parseInt(form.maxMarks) || 100,
        passingMarks: parseInt(form.passingMarks) || 40,
        teacherId: form.teacherId || null,
      };

      if (editItem) {
        await apiCall(() => window.api.subjects.update(editItem.id, payload));
        success('Subject updated successfully');
      } else {
        await apiCall(() => window.api.subjects.create(payload));
        success('Subject created successfully');
      }

      setShowModal(false);
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save subject');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiCall(() => window.api.subjects.delete(deleteTarget.id));
      success(`Subject ${deleteTarget.name} deleted successfully`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete subject');
    } finally {
      setDeleting(false);
    }
  };

  // Filtered Subjects
  const filteredSubjects = useMemo(() => {
    return subjects.filter((s) => {
      const matchesClass =
        selectedClassId === 'ALL' || s.classId === selectedClassId;
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.teacher?.name?.toLowerCase().includes(q);
      return matchesClass && matchesSearch;
    });
  }, [subjects, selectedClassId, search]);

  // Grouped by Class when ALL is selected
  const subjectsByClass = useMemo(() => {
    const map = new Map<string, { classInfo: ClassItem; subjects: SubjectItem[] }>();
    for (const cls of classes) {
      map.set(cls.id, { classInfo: cls, subjects: [] });
    }
    for (const sub of filteredSubjects) {
      const entry = map.get(sub.classId);
      if (entry) {
        entry.subjects.push(sub);
      } else if (sub.class) {
        map.set(sub.classId, { classInfo: sub.class, subjects: [sub] });
      }
    }
    return Array.from(map.values()).filter((group) =>
      selectedClassId === 'ALL' ? group.subjects.length > 0 : group.classInfo.id === selectedClassId
    );
  }, [filteredSubjects, classes, selectedClassId]);

  // Stats
  const totalSubjectsCount = subjects.length;
  const classesWithSubjectsCount = new Set(subjects.map((s) => s.classId)).size;
  const teachersAssignedCount = new Set(
    subjects.filter((s) => s.teacherId).map((s) => s.teacherId)
  ).size;

  if (loading) return <LoadingSpinner message="Loading subjects directory..." />;

  return (
    <div className="space-y-6 pb-16">
      {/* ── Page Header ────────────────────────────────────────────────────── */}
      <PageHeader
        title="Subjects Directory"
        subtitle="Manage and organize academic subjects, credit marks, and teacher assignments class-wise"
        actions={
          <Button onClick={openAddModal} className="flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" /> Add Subject
          </Button>
        }
      />

      {/* ── Stats Summary ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-primary-50/50 via-transparent to-transparent dark:from-primary-950/20 border-primary-100 dark:border-primary-900/40">
          <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {totalSubjectsCount}
            </p>
            <p className="text-xs text-gray-500 font-medium">Total Subjects Created</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-indigo-50/50 via-transparent to-transparent dark:from-indigo-950/20 border-indigo-100 dark:border-indigo-900/40">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-600 dark:text-indigo-400 flex-shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
              {classesWithSubjectsCount} <span className="text-xs text-gray-400 font-normal">/ {classes.length}</span>
            </p>
            <p className="text-xs text-gray-500 font-medium">Classes Configured</p>
          </div>
        </div>

        <div className="card p-4 flex items-center gap-3.5 bg-gradient-to-br from-emerald-50/50 via-transparent to-transparent dark:from-emerald-950/20 border-emerald-100 dark:border-emerald-900/40">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400 flex-shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {teachersAssignedCount}
            </p>
            <p className="text-xs text-gray-500 font-medium">Faculty Assigned</p>
          </div>
        </div>
      </div>

      {/* ── Class Tabs & Search Bar ───────────────────────────────────────── */}
      <div className="card p-4 space-y-4">
        {/* Class Selection Tabs */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Filter by Class
            </label>
            <span className="text-xs text-gray-400 font-medium">
              Showing {filteredSubjects.length} subject{filteredSubjects.length !== 1 ? 's' : ''}
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setSelectedClassId('ALL')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedClassId === 'ALL'
                  ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/30'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              All Classes ({subjects.length})
            </button>

            {classes.map((cls) => {
              const count = subjects.filter((s) => s.classId === cls.id).length;
              const isSelected = selectedClassId === cls.id;
              const label = cls.name.startsWith('Class ') ? cls.name : `Class ${cls.name}`;

              return (
                <button
                  key={cls.id}
                  type="button"
                  onClick={() => setSelectedClassId(cls.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-primary-600 text-white shadow-sm ring-2 ring-primary-500/30'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {label}
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      isSelected
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Search Input */}
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by subject name, code (e.g. MATH), or teacher..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10 text-xs py-2 w-full"
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

      {/* ── Class-Wise Subject Listings ──────────────────────────────────── */}
      {filteredSubjects.length === 0 ? (
        <div className="card p-12">
          <EmptyState
            title="No subjects found"
            description={
              search
                ? 'No subjects match your search keyword.'
                : selectedClassId !== 'ALL'
                ? 'No subjects configured for this class yet.'
                : 'Get started by creating subjects for your classes.'
            }
            action={
              <Button onClick={openAddModal}>
                <Plus className="w-4 h-4 mr-1" /> Add New Subject
              </Button>
            }
          />
        </div>
      ) : (
        <div className="space-y-6">
          {subjectsByClass.map((group) => {
            const classLabel = group.classInfo.name.startsWith('Class ')
              ? group.classInfo.name
              : `Class ${group.classInfo.name}`;

            return (
              <div
                key={group.classInfo.id}
                className="card overflow-hidden border border-gray-200 dark:border-gray-800 shadow-sm"
              >
                {/* Class Section Header */}
                <div className="px-5 py-3.5 bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center text-primary-600 dark:text-primary-400 font-bold text-xs">
                      {group.classInfo.name.replace(/\D/g, '') || group.classInfo.name.slice(0, 2)}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                        {classLabel}
                      </h3>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-950/40 text-primary-600 dark:text-primary-400 font-medium">
                      {group.subjects.length} Subject{group.subjects.length > 1 ? 's' : ''}
                    </span>
                  </div>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditItem(null);
                      setForm({
                        name: '',
                        code: '',
                        classId: group.classInfo.id,
                        maxMarks: '100',
                        passingMarks: '40',
                        teacherId: '',
                      });
                      setShowModal(true);
                    }}
                    className="text-xs text-primary-600 hover:text-primary-700"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Subject to {classLabel}
                  </Button>
                </div>

                {/* Table of Subjects in this class */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead className="bg-gray-50/40 dark:bg-gray-800/40 border-b border-gray-100 dark:border-gray-800">
                      <tr>
                        <th className="text-left p-3.5 font-semibold text-xs text-gray-500 uppercase tracking-wider w-24">
                          Code
                        </th>
                        <th className="text-left p-3.5 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                          Subject Name
                        </th>
                        <th className="text-left p-3.5 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                          Marks Evaluation
                        </th>
                        <th className="text-left p-3.5 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                          Assigned Teacher
                        </th>
                        <th className="text-right p-3.5 font-semibold text-xs text-gray-500 uppercase tracking-wider w-28">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {group.subjects.map((s) => (
                        <tr
                          key={s.id}
                          className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                        >
                          {/* Code */}
                          <td className="p-3.5">
                            <span className="px-2 py-1 rounded-md font-mono text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                              {s.code}
                            </span>
                          </td>

                          {/* Name */}
                          <td className="p-3.5">
                            <p className="font-semibold text-gray-900 dark:text-white">
                              {s.name}
                            </p>
                          </td>

                          {/* Evaluation Marks */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-medium">
                                <Award className="w-3 h-3" /> Max: {s.maxMarks}
                              </span>
                              <span className="text-xs text-gray-400 font-medium">
                                Pass: {s.passingMarks}
                              </span>
                            </div>
                          </td>

                          {/* Teacher */}
                          <td className="p-3.5">
                            {s.teacher ? (
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0 text-primary-600 text-[10px] font-bold">
                                  {s.teacher.photoPath ? (
                                    <img
                                      src={getLocalFileUrl(s.teacher.photoPath)}
                                      alt={s.teacher.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    s.teacher.name.charAt(0)
                                  )}
                                </div>
                                <span className="font-medium text-xs text-gray-800 dark:text-gray-200">
                                  {s.teacher.name}
                                </span>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 italic">
                                Not assigned
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="p-3.5 text-right">
                            <div className="flex justify-end items-center gap-1">
                              <button
                                type="button"
                                onClick={() => openEditModal(s)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                title="Edit Subject"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteTarget(s)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Delete Subject"
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
              </div>
            );
          })}
        </div>
      )}

      {/* ── Add / Edit Subject Modal ──────────────────────────────────────── */}
      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={editItem ? `Edit Subject: ${editItem.name}` : 'Add New Subject'}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4">
          {/* Quick Suggestions (only for new) */}
          {!editItem && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Quick Subject Suggestions
              </p>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_SUBJECT_SUGGESTIONS.slice(0, 8).map((sug) => (
                  <button
                    key={sug.code}
                    type="button"
                    onClick={() => handleNameSelect(sug.name)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-primary-50 dark:hover:bg-primary-950/40 text-gray-700 dark:text-gray-300 hover:text-primary-600 border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    + {sug.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Subject Name *"
                required
                placeholder="e.g. Mathematics, Science, English"
                value={form.name}
                onChange={(e) => handleNameSelect(e.target.value)}
              />
            </div>

            <Input
              label="Subject Code *"
              required
              placeholder="e.g. MATH, ENG, CS"
              value={form.code}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
              }
            />

            <Select
              label="Class *"
              options={classes.map((c) => ({
                value: c.id,
                label: c.name.startsWith('Class ') ? c.name : `Class ${c.name}`,
              }))}
              placeholder="Select Class"
              value={form.classId}
              onChange={(e) => setForm((prev) => ({ ...prev, classId: e.target.value }))}
            />

            <Input
              label="Maximum Marks *"
              type="number"
              min="1"
              value={form.maxMarks}
              onChange={(e) => setForm((prev) => ({ ...prev, maxMarks: e.target.value }))}
            />

            <Input
              label="Passing Marks *"
              type="number"
              min="1"
              value={form.passingMarks}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, passingMarks: e.target.value }))
              }
            />

            <div className="sm:col-span-2">
              <Select
                label="Assigned Teacher (Optional)"
                options={teachers.map((t) => ({ value: t.id, label: t.name }))}
                placeholder="Select faculty / teacher"
                value={form.teacherId}
                onChange={(e) => setForm((prev) => ({ ...prev, teacherId: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowModal(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editItem ? 'Update Subject' : 'Save Subject'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Delete Confirmation Dialog ────────────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Delete Subject"
        message={`Are you sure you want to delete ${deleteTarget?.name} (${deleteTarget?.code}) for Class ${deleteTarget?.class?.name}?`}
        confirmText="Delete Subject"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}
