import { useState, useEffect } from 'react';
import { Save, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { apiCall } from '../../utils/helpers';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE';

export default function AttendancePage() {
  const { academicYear } = useApp();
  const { success, error: showError } = useToast();
  const [classes, setClasses] = useState<{ id: string; name: string; sections: { id: string; name: string }[] }[]>([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<{ student: { id: string; name: string; rollNumber: string }; status: AttendanceStatus }[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadClasses(); }, []);

  const loadClasses = async () => {
    const data = await apiCall(() => window.api.classes.list());
    setClasses(data as typeof classes);
  };

  const loadAttendance = async () => {
    if (!selectedSection || !academicYear?.id) return;
    setLoading(true);
    try {
      const data = await apiCall(() => window.api.attendance.get(selectedSection, date, academicYear.id)) as {
        records: { student: { id: string; name: string; rollNumber: string }; attendance: { status: AttendanceStatus } | null }[];
      };
      setRecords(data.records.map(r => ({
        student: r.student,
        status: r.attendance?.status || 'PRESENT',
      })));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (selectedSection) loadAttendance(); }, [selectedSection, date]);

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords(prev => prev.map(r => r.student.id === studentId ? { ...r, status } : r));
  };

  const markAll = (status: AttendanceStatus) => {
    setRecords(prev => prev.map(r => ({ ...r, status })));
  };

  const handleSave = async () => {
    if (!selectedSection || !academicYear?.id) return;
    setSaving(true);
    try {
      await apiCall(() => window.api.attendance.save({
        sectionId: selectedSection,
        academicYearId: academicYear.id,
        date: new Date(date),
        records: records.map(r => ({ studentId: r.student.id, status: r.status })),
      }));
      success('Attendance saved successfully!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const selectedClassData = classes.find(c => c.id === selectedClass);
  const statusButtons = [
    { status: 'PRESENT' as const, icon: CheckCircle, color: 'text-green-600 bg-green-50 border-green-200' },
    { status: 'ABSENT' as const, icon: XCircle, color: 'text-red-600 bg-red-50 border-red-200' },
    { status: 'LEAVE' as const, icon: Clock, color: 'text-yellow-600 bg-yellow-50 border-yellow-200' },
  ];

  return (
    <div>
      <PageHeader title="Attendance" subtitle="Mark daily attendance for students" />

      <div className="card p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select label="Class" options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))} placeholder="Select class" value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(''); }} />
          <Select label="Section" options={(selectedClassData?.sections || []).map(s => ({ value: s.id, label: s.name }))} placeholder="Select section" value={selectedSection} onChange={e => setSelectedSection(e.target.value)} />
          <div>
            <label className="label">Date</label>
            <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="secondary" onClick={() => markAll('PRESENT')}>All Present</Button>
            <Button variant="secondary" onClick={() => markAll('ABSENT')}>All Absent</Button>
          </div>
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
                  <th className="text-center p-4">Present</th>
                  <th className="text-center p-4">Absent</th>
                  <th className="text-center p-4">Leave</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.student.id} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-4">{r.student.rollNumber}</td>
                    <td className="p-4 font-medium">{r.student.name}</td>
                    {statusButtons.map(({ status, icon: Icon, color }) => (
                      <td key={status} className="p-4 text-center">
                        <button
                          onClick={() => updateStatus(r.student.id, status)}
                          className={`p-2 rounded-lg border transition-all ${r.status === status ? color + ' ring-2 ring-offset-1' : 'border-gray-200 text-gray-400 hover:bg-gray-50'}`}
                        >
                          <Icon className="w-5 h-5" />
                        </button>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-4 border-t flex justify-end">
            <Button onClick={handleSave} loading={saving}><Save className="w-4 h-4" /> Save Attendance</Button>
          </div>
        </div>
      )}

      {!loading && selectedSection && records.length === 0 && (
        <div className="card p-8 text-center text-gray-500">No students found in this section.</div>
      )}
    </div>
  );
}
