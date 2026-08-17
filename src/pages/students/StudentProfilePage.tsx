import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, User, CreditCard, ClipboardCheck, FileText, FolderOpen, Activity } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, Badge } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { formatCurrency, formatDate, apiCall } from '../../utils/helpers';

const tabs = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'fees', label: 'Fees', icon: CreditCard },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'results', label: 'Results', icon: FileText },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'activity', label: 'Activity', icon: Activity },
];

export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { academicYear } = useApp();
  const { error: showError } = useToast();
  const navigate = useNavigate();
  const [student, setStudent] = useState<Record<string, any> | null>(null);
  const [attendance, setAttendance] = useState<Record<string, number> | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) loadStudent(); }, [id]);

  const loadStudent = async () => {
    setLoading(true);
    try {
      const [data, att] = await Promise.all([
        apiCall(() => window.api.students.get(id!)),
        apiCall(() => window.api.students.getAttendance(id!, academicYear?.id)),
      ]);
      setStudent(data as Record<string, unknown>);
      setAttendance(att as Record<string, number>);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load student');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;
  if (!student) return null;

  const s = student as Record<string, unknown>;
  const cls = s.class as { name: string } | undefined;
  const sec = s.section as { name: string } | undefined;
  const fees = (s.studentFees as Record<string, unknown>[]) || [];
  const fee = fees[0];
  const payments = (s.feePayments as Record<string, unknown>[]) || [];
  const results = (s.results as Record<string, unknown>[]) || [];
  const documents = (s.documents as Record<string, unknown>[]) || [];

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => navigate('/students')}><ArrowLeft className="w-4 h-4" /></Button>
        <PageHeader title={s.name as string} subtitle={`${s.admissionNumber} • Class ${cls?.name}-${sec?.name}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="card p-6 text-center">
          <div className="w-24 h-24 mx-auto rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4">
            <User className="w-12 h-12 text-primary-600" />
          </div>
          <h2 className="font-bold text-lg">{s.name as string}</h2>
          <p className="text-sm text-gray-500">{s.admissionNumber as string}</p>
          <div className="mt-3 flex justify-center gap-2">
            <Badge variant="info">Class {cls?.name}-{sec?.name}</Badge>
            <Badge variant="gray">Roll {s.rollNumber as string}</Badge>
          </div>
          {(s.isDemo as boolean) && <Badge variant="warning">Demo Data</Badge>}
          <div className="mt-4 space-y-2">
            <Button variant="secondary" className="w-full" onClick={() => navigate(`/payments/new?studentId=${id}`)}>Record Payment</Button>
            <Button variant="ghost" className="w-full" onClick={() => navigate(`/students/${id}/edit`)}>Edit Profile</Button>
          </div>
        </div>

        <div className="lg:col-span-3">
          <div className="flex gap-1 mb-4 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${activeTab === tab.id ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
              >
                <tab.icon className="w-4 h-4" />{tab.label}
              </button>
            ))}
          </div>

          <div className="card p-6">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {([
                  ['Father\'s Name', s.fatherName], ['Mother\'s Name', s.motherName],
                  ['Date of Birth', s.dateOfBirth ? formatDate(s.dateOfBirth as string) : '-'],
                  ['Gender', s.gender], ['Blood Group', s.bloodGroup], ['Phone', s.phone],
                  ['Email', s.email], ['Address', s.address], ['City', s.city],
                  ['Admission Date', s.admissionDate ? formatDate(s.admissionDate as string) : '-'],
                  ['Previous School', s.previousSchool], ['Emergency Contact', s.emergencyContact],
                ] as [string, string | undefined][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className="text-sm font-medium">{value || '-'}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'fees' && fee && (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="card p-4 bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-xs text-gray-500">Total Fee</p>
                    <p className="text-xl font-bold">{formatCurrency(fee.totalPaise as number)}</p>
                  </div>
                  <div className="card p-4 bg-green-50 dark:bg-green-900/20">
                    <p className="text-xs text-gray-500">Paid</p>
                    <p className="text-xl font-bold text-green-600">{formatCurrency(fee.paidPaise as number)}</p>
                  </div>
                  <div className="card p-4 bg-orange-50 dark:bg-orange-900/20">
                    <p className="text-xs text-gray-500">Pending</p>
                    <p className="text-xl font-bold text-orange-600">{formatCurrency((fee.totalPaise as number) - (fee.paidPaise as number))}</p>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-3 mb-6">
                  <div className="bg-green-500 h-3 rounded-full transition-all" style={{ width: `${Math.min(100, ((fee.paidPaise as number) / (fee.totalPaise as number)) * 100)}%` }} />
                </div>
                <h4 className="font-medium mb-3">Payment History</h4>
                {payments.length === 0 ? <p className="text-sm text-gray-500">No payments recorded</p> : (
                  <div className="space-y-2">
                    {payments.map((p, i) => (
                      <div key={i} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800">
                        <div>
                          <p className="text-sm font-medium">{p.receiptNumber as string}</p>
                          <p className="text-xs text-gray-500">{formatDate(p.paymentDate as string)} • {p.paymentMethod as string}</p>
                        </div>
                        <span className="font-semibold text-green-600">{formatCurrency(p.amountPaise as number)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'attendance' && attendance && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 card"><p className="text-2xl font-bold">{attendance.workingDays}</p><p className="text-xs text-gray-500">Working Days</p></div>
                <div className="text-center p-4 card"><p className="text-2xl font-bold text-green-600">{attendance.present}</p><p className="text-xs text-gray-500">Present</p></div>
                <div className="text-center p-4 card"><p className="text-2xl font-bold text-red-600">{attendance.absent}</p><p className="text-xs text-gray-500">Absent</p></div>
                <div className="text-center p-4 card"><p className="text-2xl font-bold text-primary-600">{attendance.percentage}%</p><p className="text-xs text-gray-500">Attendance</p></div>
              </div>
            )}

            {activeTab === 'results' && (
              results.length === 0 ? <p className="text-sm text-gray-500">No results recorded</p> : (
                <table className="w-full text-sm">
                  <thead><tr className="border-b"><th className="text-left p-2">Exam</th><th className="text-left p-2">Subject</th><th className="text-right p-2">Marks</th><th className="text-right p-2">Grade</th></tr></thead>
                  <tbody>
                    {results.map((r, i) => {
                      const exam = r.exam as { name: string };
                      const subject = r.subject as { name: string };
                      return (
                        <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                          <td className="p-2">{exam?.name}</td>
                          <td className="p-2">{subject?.name}</td>
                          <td className="p-2 text-right">{r.marksObtained as number}/{r.maxMarks as number}</td>
                          <td className="p-2 text-right"><Badge variant="info">{r.grade as string}</Badge></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )
            )}

            {activeTab === 'documents' && (
              documents.length === 0 ? <p className="text-sm text-gray-500">No documents uploaded</p> : (
                <div className="space-y-2">
                  {documents.map((d, i) => (
                    <div key={i} className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-sm">{d.name as string}</span>
                      <Badge variant="gray">{d.type as string}</Badge>
                    </div>
                  ))}
                </div>
              )
            )}

            {activeTab === 'activity' && (
              <p className="text-sm text-gray-500">Recent activity for this student will appear here.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
