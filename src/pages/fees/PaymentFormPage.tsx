import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Printer,
  Download,
  Search,
  CheckCircle2,
  User,
  Wallet,
  CreditCard,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatCurrency, PAYMENT_METHODS, apiCall, getLocalFileUrl } from '../../utils/helpers';
import { generateReceiptPDF } from '../../utils/pdf';

const paymentSchema = z.object({
  studentId: z.string().min(1, 'Please select a student'),
  amount: z.coerce.number().min(1, 'Amount must be greater than 0'),
  paymentDate: z.string().min(1, 'Date is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  feeCategoryId: z.string().optional(),
  remarks: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

interface StudentItem {
  id: string;
  name: string;
  admissionNumber: string;
  rollNumber?: string | null;
  photoPath?: string | null;
  classId?: string | null;
  sectionId?: string | null;
  class?: { id: string; name: string } | null;
  section?: { id: string; name: string } | null;
}

export default function PaymentFormPage() {
  const [searchParams] = useSearchParams();
  const { academicYear, schoolSettings } = useApp();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string; sections: { id: string; name: string }[] }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);

  // Class & Search Filter States
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSectionId, setSelectedSectionId] = useState<string>('');
  const [studentSearchQuery, setStudentSearchQuery] = useState<string>('');

  const [studentFees, setStudentFees] = useState<{ totalPaise: number; paidPaise: number } | null>(null);
  const [lastPayment, setLastPayment] = useState<Record<string, unknown> | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      studentId: '',
      amount: undefined,
      paymentDate: new Date().toISOString().split('T')[0],
      paymentMethod: 'CASH',
      remarks: '',
    },
  });

  const selectedStudentId = watch('studentId');

  useEffect(() => {
    loadInitialData();
  }, [academicYear?.id]);

  useEffect(() => {
    const preselected = searchParams.get('studentId');
    if (preselected && students.length > 0) {
      setValue('studentId', preselected);
      const matched = students.find((s) => s.id === preselected);
      if (matched?.classId) setSelectedClassId(matched.classId);
      if (matched?.sectionId) setSelectedSectionId(matched.sectionId);
    }
  }, [searchParams, students]);

  useEffect(() => {
    if (selectedStudentId) {
      loadStudentFees(selectedStudentId);
    } else {
      setStudentFees(null);
    }
  }, [selectedStudentId, academicYear?.id]);

  const loadInitialData = async () => {
    setPageLoading(true);
    try {
      const [studentData, classData, catData] = await Promise.all([
        apiCall(() => window.api.students.list({ academicYearId: academicYear?.id, limit: 500 })),
        apiCall(() => window.api.classes.list()),
        apiCall(() => window.api.fees.getCategories()),
      ]);

      const stuList = (studentData as { students: StudentItem[] })?.students || [];
      setStudents(stuList);
      setClasses((classData as typeof classes) || []);
      setCategories((catData as typeof categories) || []);
    } catch (err) {
      showError('Failed to load initial form data');
    } finally {
      setPageLoading(false);
    }
  };

  const loadStudentFees = async (studentId: string) => {
    try {
      const fees = await apiCall(() => window.api.fees.getStudentFees(studentId, academicYear?.id));
      const feeList = fees as { totalPaise: number; paidPaise: number }[];
      setStudentFees(feeList[0] || null);
    } catch {
      setStudentFees(null);
    }
  };

  // Filter students based on Class, Section, and Search Query
  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      // Class filter
      if (selectedClassId && s.classId !== selectedClassId && s.class?.id !== selectedClassId) {
        return false;
      }
      // Section filter
      if (selectedSectionId && s.sectionId !== selectedSectionId && s.section?.id !== selectedSectionId) {
        return false;
      }
      // Text Search Query (Name, Roll, Admission No)
      if (studentSearchQuery.trim()) {
        const query = studentSearchQuery.toLowerCase();
        const nameMatch = s.name?.toLowerCase().includes(query);
        const admMatch = s.admissionNumber?.toLowerCase().includes(query);
        const rollMatch = s.rollNumber?.toLowerCase().includes(query);
        return nameMatch || admMatch || rollMatch;
      }
      return true;
    });
  }, [students, selectedClassId, selectedSectionId, studentSearchQuery]);

  const selectedStudent = useMemo(() => {
    return students.find((s) => s.id === selectedStudentId);
  }, [students, selectedStudentId]);

  const onSubmit = async (data: PaymentForm) => {
    setLoading(true);
    try {
      const payment = await apiCall(() =>
        window.api.fees.recordPayment({
          studentId: data.studentId,
          academicYearId: academicYear?.id,
          amountPaise: Math.round(data.amount * 100),
          paymentDate: new Date(data.paymentDate),
          paymentMethod: data.paymentMethod,
          feeCategoryId: data.feeCategoryId || undefined,
          remarks: data.remarks || 'Fee payment',
        })
      );

      setLastPayment(payment as Record<string, unknown>);
      success('Payment recorded successfully! Receipt generated.');
      // Refresh student fee balance
      loadStudentFees(data.studentId);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!lastPayment) return;
    const paymentData = {
      ...lastPayment,
      student: selectedStudent || lastPayment.student,
    };
    await generateReceiptPDF(paymentData, schoolSettings as Record<string, string>);
    window.print();
  };

  const handleResetForNewPayment = () => {
    setLastPayment(null);
    setValue('amount', 0);
    setValue('remarks', '');
  };

  const pendingPaise = studentFees ? Math.max(0, studentFees.totalPaise - studentFees.paidPaise) : 0;
  const pendingRupees = pendingPaise / 100;

  const currentClassSections = useMemo(() => {
    const cls = classes.find((c) => c.id === selectedClassId);
    return cls?.sections || [];
  }, [classes, selectedClassId]);

  if (pageLoading) return <LoadingSpinner message="Loading payment module..." />;

  return (
    <div className="max-w-6xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => navigate('/payments')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <PageHeader
            title="Record Fee Payment"
            subtitle="Search student by class & name to collect fees and generate receipt"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Column: Student Selection & Payment Form ─────────────── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Filter & Search Student Card */}
          <div className="card p-6 border-2 border-primary-50 dark:border-gray-800">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <User className="w-4 h-4 text-primary-600" />
              1. Select Student
            </h3>

            {/* Class & Section Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                  Filter by Class
                </label>
                <select
                  value={selectedClassId}
                  onChange={(e) => {
                    setSelectedClassId(e.target.value);
                    setSelectedSectionId('');
                  }}
                  className="input w-full"
                >
                  <option value="">All Classes</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      Class {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                  Filter by Section
                </label>
                <select
                  value={selectedSectionId}
                  onChange={(e) => setSelectedSectionId(e.target.value)}
                  disabled={!selectedClassId || currentClassSections.length === 0}
                  className="input w-full disabled:opacity-50"
                >
                  <option value="">All Sections</option>
                  {currentClassSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      Section {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Student Search & Dropdown */}
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                  Search Student (Name / Roll No / Admission No)
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
                  <input
                    type="text"
                    placeholder="Type student name, admission no (e.g. ADM-2026-0001), or roll number..."
                    value={studentSearchQuery}
                    onChange={(e) => setStudentSearchQuery(e.target.value)}
                    className="input w-full pl-10"
                  />
                  {studentSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setStudentSearchQuery('')}
                      className="absolute right-3 top-2.5 text-xs text-gray-400 hover:text-gray-600 px-1.5 py-0.5 rounded"
                    >
                      Clear
                    </button>
                  )}
                </div>
              </div>

              {/* Student Select Listbox */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
                  Select Student * ({filteredStudents.length} available)
                </label>
                <select
                  className={`input w-full ${errors.studentId ? 'border-red-400 focus:ring-red-400' : ''}`}
                  value={selectedStudentId}
                  onChange={(e) => setValue('studentId', e.target.value, { shouldValidate: true })}
                >
                  <option value="">-- Choose Student from list --</option>
                  {filteredStudents.map((s) => {
                    const clsName = s.class?.name ? `Class ${s.class.name}` : 'No Class';
                    const secName = s.section?.name ? `-${s.section.name}` : '';
                    const roll = s.rollNumber ? ` • Roll: ${s.rollNumber}` : '';
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.admissionNumber}) — {clsName}{secName}{roll}
                      </option>
                    );
                  })}
                </select>
                {errors.studentId && (
                  <p className="text-xs text-red-500 mt-1">{errors.studentId.message}</p>
                )}
              </div>
            </div>

            {/* Selected Student Information Chip */}
            {selectedStudent && (
              <div className="mt-4 p-4 rounded-xl bg-primary-50/50 dark:bg-primary-950/30 border border-primary-100 dark:border-primary-900/50 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-primary-100 dark:bg-primary-900 flex items-center justify-center border-2 border-primary-200 dark:border-primary-800">
                    {selectedStudent.photoPath ? (
                      <img
                        src={getLocalFileUrl(selectedStudent.photoPath)}
                        alt={selectedStudent.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-6 h-6 text-primary-600" />
                    )}
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:text-white text-base">
                      {selectedStudent.name}
                    </h4>
                    <p className="text-xs text-gray-500 font-mono">
                      {selectedStudent.admissionNumber} • {selectedStudent.class?.name ? `Class ${selectedStudent.class.name}` : ''}{selectedStudent.section?.name ? `-${selectedStudent.section.name}` : ''} {selectedStudent.rollNumber ? `• Roll: ${selectedStudent.rollNumber}` : ''}
                    </p>
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => navigate(`/students/${selectedStudent.id}`)}
                  className="flex items-center gap-1 text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> View Profile
                </Button>
              </div>
            )}
          </div>

          {/* Step 2: Payment Entry Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="card p-6 space-y-5">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              2. Payment Details
            </h3>

            {/* Quick Amount Auto-fills if pending exists */}
            {pendingRupees > 0 && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-gray-500 font-medium">Quick Amount:</span>
                <button
                  type="button"
                  onClick={() => setValue('amount', pendingRupees, { shouldValidate: true })}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold hover:bg-emerald-100 transition-colors border border-emerald-200 dark:border-emerald-800"
                >
                  Pay Full Due (₹{pendingRupees.toLocaleString()})
                </button>
                {[500, 1000, 2000, 5000].map((amt) => {
                  if (amt >= pendingRupees) return null;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setValue('amount', amt, { shouldValidate: true })}
                      className="px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-200 transition-colors"
                    >
                      ₹{amt.toLocaleString()}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Amount (₹) *"
                type="number"
                step="1"
                min="1"
                placeholder="Enter payment amount"
                error={errors.amount?.message}
                {...register('amount')}
              />

              <Input
                label="Payment Date *"
                type="date"
                error={errors.paymentDate?.message}
                {...register('paymentDate')}
              />

              <Select
                label="Payment Method *"
                options={PAYMENT_METHODS}
                error={errors.paymentMethod?.message}
                {...register('paymentMethod')}
              />

              <Select
                label="Fee Category"
                options={categories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select category (e.g. Tuition Fee, Admission Fee)"
                {...register('feeCategoryId')}
              />

              <div className="sm:col-span-2">
                <Input
                  label="Remarks / Note"
                  placeholder="e.g. Term fee, Online transaction reference, Cash receipt"
                  {...register('remarks')}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              <Button variant="secondary" type="button" onClick={() => navigate('/payments')}>
                Cancel
              </Button>
              <Button type="submit" loading={loading} disabled={!selectedStudentId}>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Record Payment & Generate Receipt
              </Button>
            </div>
          </form>
        </div>

        {/* ── Right Column: Fee Summary & Live Receipt ─────────────────── */}
        <div className="space-y-6">
          {/* Fee Balance Card */}
          <div className="card p-5">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-primary-600" />
              Student Fee Account
            </h3>

            {studentFees ? (
              <div className="space-y-3.5">
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-500">Total Applicable Fee</span>
                  <span className="font-bold text-gray-900 dark:text-white">
                    {formatCurrency(studentFees.totalPaise)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-500">Already Paid</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(studentFees.paidPaise)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1.5 border-b border-gray-100 dark:border-gray-800">
                  <span className="text-sm text-gray-500">Remaining Due</span>
                  <span className={`font-bold ${pendingPaise > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                    {formatCurrency(pendingPaise)}
                  </span>
                </div>

                <div className="pt-2">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Payment Progress</span>
                    <span>
                      {studentFees.totalPaise > 0
                        ? `${Math.round((studentFees.paidPaise / studentFees.totalPaise) * 100)}%`
                        : '100%'}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${studentFees.totalPaise > 0 ? Math.min(100, (studentFees.paidPaise / studentFees.totalPaise) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-400 text-sm">
                Select a student to view fee status and outstanding balance.
              </div>
            )}
          </div>

          {/* Success / Last Receipt Card */}
          {lastPayment && (
            <div className="card p-5 border-2 border-emerald-200 dark:border-emerald-800 bg-gradient-to-br from-emerald-50/60 to-transparent dark:from-emerald-950/30">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h3 className="font-bold text-emerald-800 dark:text-emerald-300">
                  Payment Successful!
                </h3>
              </div>

              <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300 mb-4 bg-white dark:bg-gray-800/80 p-3 rounded-xl border border-emerald-100 dark:border-emerald-900/40">
                <div className="flex justify-between">
                  <span className="text-gray-500">Receipt No:</span>
                  <strong className="font-mono">{lastPayment.receiptNumber as string}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Amount:</span>
                  <strong className="text-emerald-600">
                    {formatCurrency(lastPayment.amountPaise as number)}
                  </strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Method:</span>
                  <span>{lastPayment.paymentMethod as string}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="sm" onClick={handlePrintReceipt} className="w-full">
                  <Printer className="w-4 h-4 mr-1" /> Print
                </Button>
                <Button variant="secondary" size="sm" onClick={handlePrintReceipt} className="w-full">
                  <Download className="w-4 h-4 mr-1" /> PDF
                </Button>
              </div>

              <div className="mt-3 pt-3 border-t border-emerald-200/50 dark:border-emerald-900/40 flex flex-col gap-2">
                {selectedStudentId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/students/${selectedStudentId}?tab=fees`)}
                    className="w-full text-xs text-primary-600 hover:text-primary-700 justify-center"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1" /> View in Student Profile
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetForNewPayment}
                  className="w-full text-xs text-gray-500 justify-center"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Record Another Payment
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
