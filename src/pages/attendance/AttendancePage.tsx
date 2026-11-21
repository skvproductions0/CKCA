import { useState, useEffect, useMemo } from 'react';
import {
  Save,
  CheckCircle,
  XCircle,
  Clock,
  User,
  Users,
  Search,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { apiCall, getLocalFileUrl, formatDate } from '../../utils/helpers';

type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LEAVE';

interface StudentInfo {
  id: string;
  name: string;
  admissionNumber?: string | null;
  rollNumber?: string | null;
  photoPath?: string | null;
}

interface AttendanceRecord {
  student: StudentInfo;
  status: AttendanceStatus;
  remarks?: string;
}

export default function AttendancePage() {
  const { academicYear } = useApp();
  const { success, error: showError } = useToast();

  const [classes, setClasses] = useState<
    { id: string; name: string; sections: { id: string; name: string }[] }[]
  >([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadClasses();
  }, []);

  const loadClasses = async () => {
    try {
      const data = await apiCall(() => window.api.classes.list());
      const classList = (data as typeof classes) || [];
      setClasses(classList);
      if (classList.length > 0 && !selectedClass) {
        setSelectedClass(classList[0].id);
        if (classList[0].sections?.length > 0) {
          setSelectedSection(classList[0].sections[0].id);
        }
      }
    } catch {
      // ignore
    }
  };

  const loadAttendance = async () => {
    if (!selectedSection || !academicYear?.id) return;
    setLoading(true);
    try {
      const data = (await apiCall(() =>
        window.api.attendance.get(selectedSection, date, academicYear.id)
      )) as {
        records: {
          student: StudentInfo;
          attendance: { status: AttendanceStatus; remarks?: string } | null;
        }[];
      };

      setRecords(
        (data.records || []).map((r) => ({
          student: r.student,
          status: r.attendance?.status || 'PRESENT',
          remarks: r.attendance?.remarks || '',
        }))
      );
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load attendance');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedSection) {
      loadAttendance();
    } else {
      setRecords([]);
    }
  }, [selectedSection, date, academicYear?.id]);

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    setRecords((prev) =>
      prev.map((r) => (r.student.id === studentId ? { ...r, status } : r))
    );
  };

  const updateRemarks = (studentId: string, remarks: string) => {
    setRecords((prev) =>
      prev.map((r) => (r.student.id === studentId ? { ...r, remarks } : r))
    );
  };

  const markAll = (status: AttendanceStatus) => {
    setRecords((prev) => prev.map((r) => ({ ...r, status })));
  };

  const handleSave = async () => {
    if (!selectedSection || !academicYear?.id) return;
    setSaving(true);
    try {
      await apiCall(() =>
        window.api.attendance.save({
          sectionId: selectedSection,
          academicYearId: academicYear.id,
          date: new Date(date),
          records: records.map((r) => ({
            studentId: r.student.id,
            status: r.status,
            remarks: r.remarks,
          })),
        })
      );
      success('Daily attendance saved successfully!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const selectedClassData = classes.find((c) => c.id === selectedClass);

  // Filter records by search query
  const filteredRecords = useMemo(() => {
    if (!searchQuery.trim()) return records;
    const q = searchQuery.toLowerCase();
    return records.filter(
      (r) =>
        r.student.name.toLowerCase().includes(q) ||
        r.student.rollNumber?.toLowerCase().includes(q) ||
        r.student.admissionNumber?.toLowerCase().includes(q)
    );
  }, [records, searchQuery]);

  // Attendance stats
  const totalCount = records.length;
  const presentCount = records.filter((r) => r.status === 'PRESENT').length;
  const absentCount = records.filter((r) => r.status === 'ABSENT').length;
  const leaveCount = records.filter((r) => r.status === 'LEAVE').length;
  const presentPercentage =
    totalCount > 0 ? Math.round((presentCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-6 pb-16">
      <PageHeader
        title="Student Attendance"
        subtitle="Mark daily attendance, track absent/leaves, and generate class records"
      />

      {/* ── 1. Filter & Date Card ────────────────────────────────────────── */}
      <div className="card p-5 border-2 border-primary-50 dark:border-gray-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          {/* Class Select */}
          <Select
            label="Class"
            options={classes.map((c) => ({
              value: c.id,
              label: c.name.startsWith('Class ') ? c.name : `Class ${c.name}`,
            }))}
            placeholder="Select class"
            value={selectedClass}
            onChange={(e) => {
              setSelectedClass(e.target.value);
              const cls = classes.find((c) => c.id === e.target.value);
              setSelectedSection(cls?.sections?.[0]?.id || '');
            }}
          />

          {/* Section Select */}
          <Select
            label="Section"
            options={(selectedClassData?.sections || []).map((s) => ({
              value: s.id,
              label: `Section ${s.name}`,
            }))}
            placeholder={
              !selectedClass
                ? '← Select class first'
                : (selectedClassData?.sections || []).length === 0
                ? 'No sections'
                : 'Select section'
            }
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
          />

          {/* Date Picker */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Date
              </label>
              <button
                type="button"
                onClick={() => setDate(new Date().toISOString().split('T')[0])}
                className="text-[11px] text-primary-600 hover:underline font-medium"
              >
                Today
              </button>
            </div>
            <div className="relative">
              <input
                type="date"
                className="input w-full"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          {/* Bulk Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            <button
              type="button"
              onClick={() => markAll('PRESENT')}
              disabled={records.length === 0}
              className="flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-3.5 h-3.5" /> All Present
            </button>
            <button
              type="button"
              onClick={() => markAll('ABSENT')}
              disabled={records.length === 0}
              className="flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60 border border-red-200 dark:border-red-800 transition-colors flex items-center justify-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <XCircle className="w-3.5 h-3.5" /> All Absent
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. Real-Time Stats Overview Card ─────────────────────────────── */}
      {records.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-4 bg-gradient-to-br from-blue-50/50 via-transparent to-transparent dark:from-blue-950/20 border-blue-100 dark:border-blue-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Total Students</span>
              <Users className="w-4 h-4 text-blue-500" />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
              {totalCount}
            </p>
            <span className="text-[11px] text-gray-400">Enrolled in section</span>
          </div>

          <div className="card p-4 bg-gradient-to-br from-emerald-50/50 via-transparent to-transparent dark:from-emerald-950/20 border-emerald-100 dark:border-emerald-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Present</span>
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2 mt-1">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {presentCount}
              </p>
              <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                ({presentPercentage}%)
              </span>
            </div>
            <div className="w-full bg-emerald-100 dark:bg-emerald-950/60 rounded-full h-1.5 mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${presentPercentage}%` }}
              />
            </div>
          </div>

          <div className="card p-4 bg-gradient-to-br from-red-50/50 via-transparent to-transparent dark:from-red-950/20 border-red-100 dark:border-red-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">Absent</span>
              <XCircle className="w-4 h-4 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {absentCount}
            </p>
            <span className="text-[11px] text-gray-400">
              {totalCount > 0 ? Math.round((absentCount / totalCount) * 100) : 0}% of class
            </span>
          </div>

          <div className="card p-4 bg-gradient-to-br from-amber-50/50 via-transparent to-transparent dark:from-amber-950/20 border-amber-100 dark:border-amber-900/40">
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500 font-medium">On Leave</span>
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
              {leaveCount}
            </p>
            <span className="text-[11px] text-gray-400">
              {totalCount > 0 ? Math.round((leaveCount / totalCount) * 100) : 0}% of class
            </span>
          </div>
        </div>
      )}

      {/* ── 3. Attendance Marking Card ────────────────────────────────────── */}
      {loading ? (
        <div className="card p-12">
          <LoadingSpinner message="Loading section students..." />
        </div>
      ) : records.length > 0 ? (
        <div className="card overflow-hidden border border-gray-200 dark:border-gray-800">
          {/* Header & Quick Search */}
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Student Attendance List ({filteredRecords.length}/{totalCount})
              </h3>
              <span className="text-xs text-gray-500 hidden sm:inline">
                • {formatDate(date)}
              </span>
            </div>

            <div className="relative max-w-xs w-full">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search student or roll no..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input pl-9 text-xs py-1.5 w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead className="bg-gray-50/80 dark:bg-gray-800/80 border-b border-gray-100 dark:border-gray-800">
                <tr>
                  <th className="text-left p-3.5 font-semibold text-xs text-gray-500 uppercase tracking-wider w-20">
                    Roll No
                  </th>
                  <th className="text-left p-3.5 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                    Student Details
                  </th>
                  <th className="text-center p-3.5 font-semibold text-xs text-gray-500 uppercase tracking-wider w-72">
                    Attendance Status
                  </th>
                  <th className="text-left p-3.5 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                    Remarks / Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {filteredRecords.map((r, index) => {
                  const s = r.student;
                  const isPresent = r.status === 'PRESENT';
                  const isAbsent = r.status === 'ABSENT';
                  const isLeave = r.status === 'LEAVE';

                  return (
                    <tr
                      key={s.id}
                      className={`transition-colors ${
                        isAbsent
                          ? 'bg-red-50/30 dark:bg-red-950/10'
                          : isLeave
                          ? 'bg-amber-50/30 dark:bg-amber-950/10'
                          : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/40'
                      }`}
                    >
                      {/* Roll Number */}
                      <td className="p-3.5 font-mono font-semibold text-xs text-gray-600 dark:text-gray-300">
                        {s.rollNumber ? (
                          <span className="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
                            #{s.rollNumber}
                          </span>
                        ) : (
                          <span className="text-gray-400">#{index + 1}</span>
                        )}
                      </td>

                      {/* Student Info */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center flex-shrink-0 border border-primary-200 dark:border-primary-800">
                            {s.photoPath ? (
                              <img
                                src={getLocalFileUrl(s.photoPath)}
                                alt={s.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-gray-900 dark:text-white text-sm">
                              {s.name}
                            </p>
                            {s.admissionNumber && (
                              <span className="font-mono text-[11px] text-gray-400 block">
                                {s.admissionNumber}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* 3-Way Segmented Toggle Status */}
                      <td className="p-3.5 text-center">
                        <div className="inline-flex p-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                          {/* Present button */}
                          <button
                            type="button"
                            onClick={() => updateStatus(s.id, 'PRESENT')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                              isPresent
                                ? 'bg-emerald-600 text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 hover:bg-white dark:hover:bg-gray-700'
                            }`}
                          >
                            <CheckCircle className="w-3.5 h-3.5" /> Present
                          </button>

                          {/* Absent button */}
                          <button
                            type="button"
                            onClick={() => updateStatus(s.id, 'ABSENT')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                              isAbsent
                                ? 'bg-red-600 text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-red-600 hover:bg-white dark:hover:bg-gray-700'
                            }`}
                          >
                            <XCircle className="w-3.5 h-3.5" /> Absent
                          </button>

                          {/* Leave button */}
                          <button
                            type="button"
                            onClick={() => updateStatus(s.id, 'LEAVE')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                              isLeave
                                ? 'bg-amber-500 text-white shadow-sm'
                                : 'text-gray-600 dark:text-gray-400 hover:text-amber-600 hover:bg-white dark:hover:bg-gray-700'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" /> Leave
                          </button>
                        </div>
                      </td>

                      {/* Remarks */}
                      <td className="p-3.5">
                        <input
                          type="text"
                          placeholder={isAbsent || isLeave ? 'Reason for absence...' : 'Optional remark...'}
                          value={r.remarks || ''}
                          onChange={(e) => updateRemarks(s.id, e.target.value)}
                          className="input text-xs py-1 px-2.5 w-full max-w-xs placeholder:text-gray-400"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Bottom Sticky Action Bar */}
          <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/40 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              Marked <strong className="text-emerald-600">{presentCount} Present</strong>,{' '}
              <strong className="text-red-600">{absentCount} Absent</strong>,{' '}
              <strong className="text-amber-600">{leaveCount} Leave</strong> out of{' '}
              <strong>{totalCount}</strong> students.
            </p>

            <Button
              onClick={handleSave}
              loading={saving}
              className="w-full sm:w-auto px-6 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" /> Save Attendance
            </Button>
          </div>
        </div>
      ) : selectedSection ? (
        <div className="card p-12 text-center">
          <EmptyState
            title="No active students found"
            description="No active students are currently enrolled in this class and section."
          />
        </div>
      ) : (
        <div className="card p-12 text-center text-gray-400 text-sm">
          Please select a Class and Section to take daily attendance.
        </div>
      )}
    </div>
  );
}
