import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, User, CreditCard, ClipboardCheck, FileText, FolderOpen, Activity, MoreVertical, Edit, Trash2, Eye, Download, ExternalLink, Printer, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, Badge } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Modal, TypeConfirmDialog } from '../../components/ui/Modal';
import { formatCurrency, formatDate, apiCall, getLocalFileUrl } from '../../utils/helpers';
import { generateReceiptPDF } from '../../utils/pdf';

const tabs = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'fees', label: 'Fees', icon: CreditCard },
  { id: 'attendance', label: 'Attendance', icon: ClipboardCheck },
  { id: 'results', label: 'Results', icon: FileText },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'activity', label: 'Activity', icon: Activity },
];

/* ── Profile 3-dot dropdown ───────────────────────────────────────────── */
function ProfileMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
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
        onClick={() => setOpen(v => !v)}
        className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
        title="More options"
      >
        <MoreVertical className="w-4 h-4 text-gray-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-30 w-44 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl py-1">
          <button
            onClick={() => { setOpen(false); onEdit(); }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
          >
            <Edit className="w-3.5 h-3.5 text-blue-500" />
            Edit Student
          </button>
          <div className="h-px bg-gray-100 dark:bg-gray-700 mx-2 my-0.5" />
          <button
            onClick={() => { setOpen(false); onDelete(); }}
            className="flex items-center gap-2.5 w-full px-3.5 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete Student
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main page ─────────────────────────────────────────────────────────── */
export default function StudentProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { academicYear, schoolSettings } = useApp();
  const { error: showError, success } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [student, setStudent] = useState<Record<string, any> | null>(null);
  const [attendance, setAttendance] = useState<Record<string, number> | null>(null);
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'overview');
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ name: string; type: string; filePath?: string } | null>(null);
  const [docDataUrl, setDocDataUrl] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(false);

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  useEffect(() => { if (id) loadStudent(); }, [id]);

  const handlePrintReceipt = async (payment: Record<string, unknown>) => {
    try {
      const paymentData = {
        ...payment,
        student: {
          name: s.name,
          admissionNumber: s.admissionNumber,
          class: cls,
          section: sec,
        },
      };
      await generateReceiptPDF(paymentData, schoolSettings as Record<string, string>);
      window.print();
    } catch (err) {
      showError('Failed to generate receipt PDF');
    }
  };

  useEffect(() => {
    if (!previewDoc?.filePath) {
      setDocDataUrl(null);
      return;
    }
    const path = previewDoc.filePath;
    if (path.startsWith('data:')) {
      setDocDataUrl(path);
      return;
    }
    setLoadingDoc(true);
    (async () => {
      try {
        if (window.api.files && typeof window.api.files.readDataUrl === 'function') {
          const res = await apiCall<string>(() => window.api.files.readDataUrl(path));
          setDocDataUrl(res);
        } else if (window.api.invoke) {
          const res = await window.api.invoke('files:readDataUrl', path);
          if (res && typeof res === 'object' && 'data' in res && (res as { data?: string }).data) {
            setDocDataUrl((res as { data: string }).data);
          } else {
            setDocDataUrl(path);
          }
        } else {
          setDocDataUrl(path);
        }
      } catch (e) {
        console.error('Failed to read file as data url:', e);
        setDocDataUrl(path);
      } finally {
        setLoadingDoc(false);
      }
    })();
  }, [previewDoc]);

  const handleOpenInSystem = async (filePath?: string) => {
    if (!filePath) return;
    try {
      if (window.api.files && typeof window.api.files.open === 'function') {
        await apiCall(() => window.api.files.open(filePath));
      } else if (window.api.invoke) {
        await window.api.invoke('files:open', filePath);
      }
      success('Opening document in default app...');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not open file in system app');
    }
  };

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

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      await apiCall(() => window.api.students.archive(id));
      success('Student deleted successfully');
      navigate('/students');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to delete student');
    } finally {
      setDeleting(false);
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
  const studentName = s.name as string;
  const photoUrl = s.photoPath as string | undefined;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => navigate('/students')}><ArrowLeft className="w-4 h-4" /></Button>
        <div className="flex-1">
          <PageHeader title={studentName} subtitle={`${s.admissionNumber} • Class ${cls?.name}-${sec?.name}`} />
        </div>
        {/* 3-dot menu in the top right of the header */}
        <ProfileMenu
          onEdit={() => navigate(`/students/${id}/edit`)}
          onDelete={() => setShowDelete(true)}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* ── Left sidebar: photo card ── */}
        <div className="card p-6 text-center">
          <div className="w-28 h-28 mx-auto rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900 flex items-center justify-center mb-4 ring-4 ring-primary-100 dark:ring-primary-900/50">
            {photoUrl ? (
              <img
                src={getLocalFileUrl(photoUrl)}
                alt={studentName}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <User className="w-14 h-14 text-primary-600" />
            )}
          </div>
          <h2 className="font-bold text-lg">{studentName}</h2>
          <p className="text-sm text-gray-500">{s.admissionNumber as string}</p>
          <div className="mt-3 flex justify-center gap-2 flex-wrap">
            <Badge variant="info">Class {cls?.name}-{sec?.name}</Badge>
            <Badge variant="gray">Roll {s.rollNumber as string}</Badge>
          </div>
          {(s.isDemo as boolean) && <div className="mt-2"><Badge variant="warning">Demo Data</Badge></div>}
          <div className="mt-4 space-y-2">
            <Button variant="secondary" className="w-full" onClick={() => navigate(`/payments/new?studentId=${id}`)}>Record Payment</Button>
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
                  ['Email', s.email],
                  ['Aadhaar Number', s.aadhaarNumber
                    ? String(s.aadhaarNumber).replace(/\D/g, '').replace(/(\d{4})(\d{4})(\d{4})/, '$1 $2 $3')
                    : undefined],
                  ['Address', s.address], ['City', s.city],
                  ['Admission Date', s.admissionDate ? formatDate(s.admissionDate as string) : '-'],
                  ['Previous School', s.previousSchool], ['Emergency Contact', s.emergencyContact],
                ] as [string, string | undefined][]).map(([label, value]) => (
                  <div key={label}>
                    <p className="text-xs text-gray-500">{label}</p>
                    <p className={`text-sm font-medium ${label === 'Aadhaar Number' && value ? 'font-mono tracking-widest' : ''}`}>{value || '-'}</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'fees' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white">Fee Status & Receipts</h4>
                  <Button
                    size="sm"
                    onClick={() => navigate(`/payments/new?studentId=${id}`)}
                    className="flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" /> Record Payment
                  </Button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                  <div className="card p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40">
                    <p className="text-xs text-gray-500 font-medium">Total Applicable Fee</p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                      {formatCurrency(fee?.totalPaise as number || 0)}
                    </p>
                  </div>
                  <div className="card p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-900/40">
                    <p className="text-xs text-gray-500 font-medium">Total Paid</p>
                    <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                      {formatCurrency(fee?.paidPaise as number || 0)}
                    </p>
                  </div>
                  <div className="card p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/40">
                    <p className="text-xs text-gray-500 font-medium">Remaining Pending Due</p>
                    <p className="text-xl font-bold text-orange-600 dark:text-orange-400 mt-1">
                      {formatCurrency(Math.max(0, ((fee?.totalPaise as number) || 0) - ((fee?.paidPaise as number) || 0)))}
                    </p>
                  </div>
                </div>

                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-6 overflow-hidden">
                  <div
                    className="bg-emerald-500 h-3 rounded-full transition-all duration-500"
                    style={{
                      width: `${(fee?.totalPaise as number) > 0 ? Math.min(100, (((fee?.paidPaise as number) || 0) / (fee?.totalPaise as number)) * 100) : 0}%`,
                    }}
                  />
                </div>

                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Payment History & Receipts ({payments.length})
                </h4>

                {payments.length === 0 ? (
                  <div className="p-8 text-center bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                    <CreditCard className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">No payment receipts recorded yet</p>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/payments/new?studentId=${id}`)}
                      className="mt-3"
                    >
                      Collect First Payment
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {payments.map((p, i) => {
                      const catName = (p.feeCategory as { name?: string })?.name;
                      return (
                        <div
                          key={i}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/40 gap-3"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">
                                {p.receiptNumber as string}
                              </span>
                              {catName && (
                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium">
                                  {catName}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              {formatDate(p.paymentDate as string)} • Method: {p.paymentMethod as string}
                              {p.remarks ? ` • Note: ${p.remarks}` : ''}
                            </p>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-center">
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-base">
                              {formatCurrency(p.amountPaise as number)}
                            </span>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handlePrintReceipt(p)}
                              className="flex items-center gap-1 text-xs"
                            >
                              <Printer className="w-3.5 h-3.5" /> Receipt
                            </Button>
                          </div>
                        </div>
                      );
                    })}
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
              documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FolderOpen className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No documents uploaded</p>
                  <p className="text-xs text-gray-400 mt-1">Documents will appear here once uploaded from the edit page.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {documents.map((d, i) => {
                    const docPath = d.filePath as string | undefined;
                    const docType = d.type as string;
                    // Map type to readable label
                    const DOC_LABELS: Record<string, string> = {
                      STUDENT_AADHAAR: "Student's Aadhaar Card", BIRTH_CERTIFICATE: 'Birth Certificate',
                      TRANSFER_CERTIFICATE: 'Transfer Certificate (TC)', MARK_SHEET: 'Previous Class Mark Sheet',
                      PASSPORT_PHOTO: 'Passport Size Photo', CASTE_CERTIFICATE: 'Caste Certificate',
                      INCOME_CERTIFICATE: 'Income Certificate', FATHER_AADHAAR: "Father's Aadhaar Card",
                      MOTHER_AADHAAR: "Mother's Aadhaar Card", GUARDIAN_AADHAAR: "Guardian's Aadhaar Card",
                      PARENT_PAN: "Parent's PAN Card", PARENT_PHOTO: "Parent's Photo",
                      ADDRESS_PROOF: 'Address Proof', INCOME_PROOF: 'Income Proof', OTHER: 'Other Document',
                    };
                    const docLabel = DOC_LABELS[docType] || docType;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
                        <div className="flex items-center gap-3">
                          <FileText className="w-5 h-5 text-primary-600 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium">{d.name as string}</p>
                            <p className="text-xs text-gray-500">{docLabel}</p>
                          </div>
                        </div>
                        {docPath && (
                          <button
                            type="button"
                            onClick={() => setPreviewDoc({ name: d.name as string, type: docLabel, filePath: docPath })}
                            className="text-xs text-primary-600 hover:text-primary-700 font-medium underline flex items-center gap-1.5 cursor-pointer bg-primary-50 dark:bg-primary-900/30 px-3 py-1.5 rounded-lg hover:bg-primary-100 transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" /> View Document
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}


            {activeTab === 'activity' && (
              <p className="text-sm text-gray-500">Recent activity for this student will appear here.</p>
            )}
          </div>
        </div>
      </div>

      {/* In-app Document Viewer Modal */}
      <Modal
        isOpen={!!previewDoc}
        onClose={() => { setPreviewDoc(null); setDocDataUrl(null); }}
        title={previewDoc?.name || 'Document Preview'}
        size="xl"
      >
        {previewDoc && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100 dark:border-gray-800">
              <span>Document Type: <strong className="text-gray-700 dark:text-gray-300 font-semibold">{previewDoc.type}</strong></span>
              <div className="flex items-center gap-3">
                {previewDoc.filePath && !previewDoc.filePath.startsWith('data:') && (
                  <button
                    type="button"
                    onClick={() => handleOpenInSystem(previewDoc.filePath)}
                    className="text-primary-600 hover:underline font-medium flex items-center gap-1 text-xs cursor-pointer bg-primary-50 dark:bg-primary-900/30 px-2.5 py-1 rounded-md"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Open in Default App
                  </button>
                )}
                {docDataUrl && (
                  <a
                    href={docDataUrl}
                    download={previewDoc.name}
                    className="text-primary-600 hover:underline font-medium flex items-center gap-1 text-xs"
                  >
                    <Download className="w-3.5 h-3.5" /> Download
                  </a>
                )}
              </div>
            </div>

            <div className="flex items-center justify-center min-h-[350px] max-h-[75vh] bg-gray-50 dark:bg-gray-800/40 rounded-xl p-2 overflow-auto border border-gray-100 dark:border-gray-800">
              {loadingDoc ? (
                <div className="flex flex-col items-center justify-center p-12">
                  <LoadingSpinner message="Loading document..." />
                </div>
              ) : docDataUrl && (docDataUrl.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(previewDoc.name)) ? (
                <img
                  src={docDataUrl}
                  alt={previewDoc.name}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
                />
              ) : docDataUrl && (docDataUrl.startsWith('data:application/pdf') || docDataUrl.startsWith('data:') || /\.pdf$/i.test(previewDoc.name)) ? (
                <embed
                  src={docDataUrl}
                  type="application/pdf"
                  className="w-full h-[70vh] rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-16 h-16 text-primary-500 mx-auto mb-3" />
                  <p className="font-semibold text-base text-gray-800 dark:text-gray-200">{previewDoc.name}</p>
                  <p className="text-xs text-gray-500 mt-1">This document is ready to download.</p>
                  {docDataUrl && (
                    <a
                      href={docDataUrl}
                      download={previewDoc.name}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download Document
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Type-to-confirm delete dialog */}
      <TypeConfirmDialog
        isOpen={showDelete}
        onClose={() => setShowDelete(false)}
        onConfirm={handleDelete}
        title="Delete Student"
        message={`This will permanently delete ${studentName}'s complete record — fees, attendance, results, and documents. This action cannot be undone.`}
        requiredText={studentName}
        confirmText="Delete Student"
        loading={deleting}
      />
    </div>
  );
}
