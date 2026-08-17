import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft, Printer, Download } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { formatCurrency, PAYMENT_METHODS, apiCall } from '../../utils/helpers';
import { generateReceiptPDF } from '../../utils/pdf';

const paymentSchema = z.object({
  studentId: z.string().min(1, 'Student is required'),
  amount: z.coerce.number().min(1, 'Amount must be greater than 0'),
  paymentDate: z.string().min(1, 'Date is required'),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  feeCategoryId: z.string().optional(),
  remarks: z.string().optional(),
});

type PaymentForm = z.infer<typeof paymentSchema>;

export default function PaymentFormPage() {
  const [searchParams] = useSearchParams();
  const { academicYear, schoolSettings } = useApp();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [students, setStudents] = useState<{ id: string; name: string; admissionNumber: string; class?: { name: string }; section?: { name: string } }[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [studentFees, setStudentFees] = useState<{ totalPaise: number; paidPaise: number } | null>(null);
  const [lastPayment, setLastPayment] = useState<Record<string, unknown> | null>(null);

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<PaymentForm>({
    resolver: zodResolver(paymentSchema),
    defaultValues: { paymentDate: new Date().toISOString().split('T')[0], paymentMethod: 'CASH' },
  });

  const selectedStudentId = watch('studentId');

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const preselected = searchParams.get('studentId');
    if (preselected) setValue('studentId', preselected);
  }, [searchParams]);
  useEffect(() => { if (selectedStudentId) loadStudentFees(selectedStudentId); }, [selectedStudentId]);

  const loadData = async () => {
    try {
      const [studentData, catData] = await Promise.all([
        apiCall(() => window.api.students.list({ academicYearId: academicYear?.id, limit: 100 })),
        apiCall(() => window.api.fees.getCategories()),
      ]);
      setStudents((studentData as { students: typeof students }).students);
      setCategories(catData as typeof categories);
    } catch { /* ignore */ }
  };

  const loadStudentFees = async (studentId: string) => {
    try {
      const fees = await apiCall(() => window.api.fees.getStudentFees(studentId, academicYear?.id));
      const feeList = fees as { totalPaise: number; paidPaise: number }[];
      setStudentFees(feeList[0] || null);
    } catch { setStudentFees(null); }
  };

  const onSubmit = async (data: PaymentForm) => {
    setLoading(true);
    try {
      const payment = await apiCall(() => window.api.fees.recordPayment({
        studentId: data.studentId,
        academicYearId: academicYear?.id,
        amountPaise: Math.round(data.amount * 100),
        paymentDate: new Date(data.paymentDate),
        paymentMethod: data.paymentMethod,
        feeCategoryId: data.feeCategoryId || undefined,
        remarks: data.remarks,
      }));
      setLastPayment(payment as Record<string, unknown>);
      success('Payment recorded successfully!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = async () => {
    if (!lastPayment) return;
    await generateReceiptPDF(lastPayment, schoolSettings as Record<string, string>);
    window.print();
  };

  const pendingPaise = studentFees ? studentFees.totalPaise - studentFees.paidPaise : 0;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => navigate('/payments')}><ArrowLeft className="w-4 h-4" /></Button>
        <PageHeader title="Record Payment" subtitle="Collect fee payment from student" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <form onSubmit={handleSubmit(onSubmit)} className="lg:col-span-2 card p-6 space-y-4">
          <Select
            label="Student *"
            options={students.map(s => ({ value: s.id, label: `${s.name} (${s.admissionNumber}) - ${s.class?.name}-${s.section?.name}` }))}
            placeholder="Select student"
            error={errors.studentId?.message}
            {...register('studentId')}
          />
          <Input label="Amount (₹) *" type="number" step="0.01" error={errors.amount?.message} {...register('amount')} />
          <Input label="Payment Date *" type="date" error={errors.paymentDate?.message} {...register('paymentDate')} />
          <Select label="Payment Method *" options={PAYMENT_METHODS} error={errors.paymentMethod?.message} {...register('paymentMethod')} />
          <Select label="Fee Category" options={categories.map(c => ({ value: c.id, label: c.name }))} placeholder="Select category (optional)" {...register('feeCategoryId')} />
          <Input label="Remarks" {...register('remarks')} />

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" type="button" onClick={() => navigate('/payments')}>Cancel</Button>
            <Button type="submit" loading={loading}>Record Payment</Button>
          </div>
        </form>

        <div className="space-y-4">
          {studentFees && (
            <div className="card p-5">
              <h3 className="font-semibold mb-4">Fee Summary</h3>
              <div className="space-y-3">
                <div className="flex justify-between"><span className="text-sm text-gray-500">Total Fee</span><span className="font-medium">{formatCurrency(studentFees.totalPaise)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-500">Paid</span><span className="font-medium text-green-600">{formatCurrency(studentFees.paidPaise)}</span></div>
                <div className="flex justify-between"><span className="text-sm text-gray-500">Pending</span><span className="font-medium text-orange-600">{formatCurrency(pendingPaise)}</span></div>
                <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                  <div className="bg-green-500 h-2 rounded-full" style={{ width: `${Math.min(100, (studentFees.paidPaise / studentFees.totalPaise) * 100)}%` }} />
                </div>
              </div>
            </div>
          )}

          {lastPayment && (
            <div className="card p-5 border-green-200 bg-green-50 dark:bg-green-900/20">
              <h3 className="font-semibold text-green-800 dark:text-green-300 mb-3">Payment Successful!</h3>
              <p className="text-sm">Receipt: {lastPayment.receiptNumber as string}</p>
              <p className="text-sm">Amount: {formatCurrency(lastPayment.amountPaise as number)}</p>
              <div className="flex gap-2 mt-4">
                <Button variant="secondary" size="sm" onClick={handlePrintReceipt}><Printer className="w-4 h-4" /> Print</Button>
                <Button variant="secondary" size="sm" onClick={handlePrintReceipt}><Download className="w-4 h-4" /> PDF</Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
