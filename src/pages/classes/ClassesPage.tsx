import { useState, useEffect } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, Badge } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Input } from '../../components/ui/Input';
import { ConfirmDialog } from '../../components/ui/Modal';
import { apiCall } from '../../utils/helpers';

interface ClassData {
  id: string;
  name: string;
  numericOrder: number;
  isActive: boolean;
  sections: { id: string; name: string; classTeacher?: { name: string }; _count?: { students: number } }[];
  _count?: { students: number };
}

export default function ClassesPage() {
  const { success, error: showError } = useToast();
  const [classes, setClasses] = useState<ClassData[]>([]);
  const [teachers, setTeachers] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddClass, setShowAddClass] = useState(false);
  const [showAddSection, setShowAddSection] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [deleteId, setDeleteId] = useState<{ type: 'class' | 'section'; id: string } | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cls, tch] = await Promise.all([
        apiCall(() => window.api.classes.list()),
        apiCall(() => window.api.teachers.list({ limit: 100 })),
      ]);
      setClasses(cls as ClassData[]);
      setTeachers((tch as { teachers: typeof teachers }).teachers);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  const handleAddClass = async () => {
    if (!newClassName) return;
    try {
      await apiCall(() => window.api.classes.create(newClassName, parseInt(newClassName) || 0));
      success('Class added');
      setShowAddClass(false);
      setNewClassName('');
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add class');
    }
  };

  const handleAddSection = async (classId: string) => {
    if (!newSectionName) return;
    try {
      await apiCall(() => window.api.sections.create(classId, newSectionName));
      success('Section added');
      setShowAddSection(null);
      setNewSectionName('');
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to add section');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      if (deleteId.type === 'class') {
        await apiCall(() => window.api.classes.delete(deleteId.id));
      } else {
        await apiCall(() => window.api.sections.delete(deleteId.id));
      }
      success('Deleted successfully');
      setDeleteId(null);
      loadData();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete');
    }
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Classes & Sections" subtitle="Manage classes and sections" actions={<Button onClick={() => setShowAddClass(true)}><Plus className="w-4 h-4" /> Add Class</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {classes.map(cls => (
          <div key={cls.id} className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold">Class {cls.name}</h3>
                <p className="text-sm text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" /> {cls._count?.students || 0} students</p>
              </div>
              <Badge variant={cls.isActive ? 'success' : 'gray'}>{cls.isActive ? 'Active' : 'Inactive'}</Badge>
            </div>

            <div className="space-y-2">
              {cls.sections.map(sec => (
                <div key={sec.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div>
                    <span className="font-medium">Section {sec.name}</span>
                    <span className="text-xs text-gray-500 ml-2">({sec._count?.students || 0} students)</span>
                    {sec.classTeacher && <p className="text-xs text-gray-400">Teacher: {sec.classTeacher.name}</p>}
                  </div>
                  <button onClick={() => setDeleteId({ type: 'section', id: sec.id })} className="p-1 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>

            <Button variant="secondary" size="sm" className="w-full mt-3" onClick={() => setShowAddSection(cls.id)}>
              <Plus className="w-3 h-3" /> Add Section
            </Button>
          </div>
        ))}
      </div>

      <Modal isOpen={showAddClass} onClose={() => setShowAddClass(false)} title="Add Class">
        <Input label="Class Name/Number" placeholder="e.g. 10" value={newClassName} onChange={e => setNewClassName(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setShowAddClass(false)}>Cancel</Button><Button onClick={handleAddClass}>Add</Button></div>
      </Modal>

      <Modal isOpen={!!showAddSection} onClose={() => setShowAddSection(null)} title="Add Section">
        <Input label="Section Name" placeholder="e.g. A" value={newSectionName} onChange={e => setNewSectionName(e.target.value)} />
        <div className="flex justify-end gap-2 mt-4"><Button variant="secondary" onClick={() => setShowAddSection(null)}>Cancel</Button><Button onClick={() => showAddSection && handleAddSection(showAddSection)}>Add</Button></div>
      </Modal>

      <ConfirmDialog isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Confirm Delete" message="Are you sure you want to delete this? Students will not be affected." />
    </div>
  );
}
