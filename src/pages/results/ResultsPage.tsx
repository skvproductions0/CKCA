import { useState, useEffect } from 'react';
import { Save } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { apiCall } from '../../utils/helpers';

export default function ResultsPage() {
  const { academicYear } = useApp();
  const { success, error: showError } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string; sections: { id: string; name: string }[] }[]>([]);
  const [exams, setExams] = useState<{ id: string; name: string }[]>([]);
  const [subjects, setSubjects] = useState<{ id: string; name: string; maxMarks: number }[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [records, setRecords] = useState<{ student: { id: string; name: string; rollNumber: string }; marks: string; maxMarks: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadClasses(); }, []);
  useEffect(() => { if (academicYear?.id) loadExams(); }, [academicYear?.id]);
  useEffect(() => { if (selectedClass) loadSubjects(); }, [selectedClass]);
  useEffect(() => { if (selectedExam && selectedSubject) loadResults(); }, [selectedExam, selectedSubject, selectedSection]);

  const loadClasses = async () => {
    const data = await apiCall(() => window.api.classes.list());
    setClasses(data as typeof classes);
  };

  const loadExams = async () => {
    const data = await apiCall(() => window.api.exams.list(academicYear?.id));
    setExams(data as typeof exams);
  };

  const loadSubjects = async () => {
    const data = await apiCall(() => window.api.subjects.list(selectedClass));
    setSubjects(data as typeof subjects);
  };

  const loadResults = async () => {
    setLoading(true);
    try {
      const data = await apiCall(() => window.api.results.getEntry(selectedExam, selectedSubject, selectedSection || undefined)) as {
        records: { student: { id: string; name: string; rollNumber: string }; result: { marksObtained: number } | null }[];
        subject: { maxMarks: number };
      };
      setRecords(data.records.map(r => ({
        student: r.student,
        marks: r.result ? String(r.result.marksObtained) : '',
        maxMarks: data.subject.maxMarks,
      })));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load results');
    } finally {
      setLoading(false);
    }
  };

  const updateMarks = (studentId: string, marks: string) => {
    setRecords(prev => prev.map(r => r.student.id === studentId ? { ...r, marks } : r));
  };

  const handleSave = async () => {
    if (!selectedExam || !selectedSubject || !academicYear?.id) return;

    for (const r of records) {
      if (r.marks && parseFloat(r.marks) > r.maxMarks) {
        showError(`Marks for ${r.student.name} cannot exceed ${r.maxMarks}`);
        return;
      }
    }

    setSaving(true);
    try {
      await apiCall(() => window.api.results.save({
        examId: selectedExam,
        subjectId: selectedSubject,
        academicYearId: academicYear.id,
        records: records.filter(r => r.marks).map(r => ({
          studentId: r.student.id,
          marksObtained: parseFloat(r.marks),
        })),
      }));
      success('Results saved successfully!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save results');
    } finally {
      setSaving(false);
    }
  };

  const selectedClassData = classes.find(c => c.id === selectedClass);

  return (
    <div>
      <PageHeader title="Results" subtitle="Enter and manage examination results" />

      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select label="Exam" options={exams.map(e => ({ value: e.id, label: e.name }))} placeholder="Select exam" value={selectedExam} onChange={e => setSelectedExam(e.target.value)} />
          <Select label="Class" options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))} placeholder="Select class" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSubject(''); }} />
          <Select label="Section" options={(selectedClassData?.sections || []).map(s => ({ value: s.id, label: s.name }))} placeholder="All sections" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} />
          <Select label="Subject" options={subjects.map(s => ({ value: s.id, label: s.name }))} placeholder="Select subject" value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} />
        </div>
      </div>

      {loading ? <LoadingSpinner /> : records.length > 0 && (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="text-left p-4 w-16">Roll</th>
                  <th className="text-left p-4">Student Name</th>
                  <th className="text-left p-4 w-32">Marks</th>
                  <th className="text-left p-4 w-24">Max</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.student.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-4">{r.student.rollNumber}</td>
                    <td className="p-4 font-medium">{r.student.name}</td>
                    <td className="p-4">
                      <Input
                        type="number"
                        min="0"
                        max={r.maxMarks}
                        value={r.marks}
                        onChange={e => updateMarks(r.student.id, e.target.value)}
                        className="w-24"
                      />
                    </td>
                    <td className="p-4 text-gray-500">{r.maxMarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t flex justify-end">
            <Button onClick={handleSave} loading={saving}><Save className="w-4 h-4" /> Save Results</Button>
          </div>
        </div>
      )}
    </div>
  );
}
