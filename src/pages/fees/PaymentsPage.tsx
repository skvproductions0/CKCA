import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  Eye,
  Printer,
  XCircle,
  CreditCard,
  User,
  ExternalLink,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState, Badge, Pagination } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Modal, ConfirmDialog } from '../../components/ui/Modal';
import { formatCurrency, formatDate, apiCall } from '../../utils/helpers';
import { generateReceiptPDF } from '../../utils/pdf';

interface PaymentItem {
  id: string;
  receiptNumber: string;
  paymentDate: string;
  amountPaise: number;
  paymentMethod: string;
  status: string;
  remarks?: string | null;
  feeCategoryId?: string | null;
  studentId: string;
  student?: {
    id: string;
    name: string;
    admissionNumber: string;
    rollNumber?: string | null;
    class?: { id: string; name: string } | null;
    section?: { id: string; name: string } | null;
  } | null;
  feeCategory?: { id: string; name: string } | null;
  collectedBy?: { fullName: string } | null;
}

export default function PaymentsPage() {
  const { academicYear, schoolSettings } = useApp();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  // Selected receipt for in-app View Modal
  const [viewPayment, setViewPayment] = useState<PaymentItem | null>(null);

  useEffect(() => {
    loadPayments();
  }, [search, page, academicYear?.id]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const result = (await apiCall(() =>
        window.api.fees.getPayments({
          search,
          academicYearId: academicYear?.id,
          page,
          limit: 20,
        })
      )) as { payments: PaymentItem[]; totalPages: number };
      setPayments(result.payments || []);
      setTotalPages(result.totalPages || 1);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load payments');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    setCancelling(true);
    try {
      await apiCall(() => window.api.fees.cancelPayment(cancelId));
      success('Payment cancelled successfully');
      setCancelId(null);
      if (viewPayment?.id === cancelId) setViewPayment(null);
      loadPayments();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to cancel payment');
    } finally {
      setCancelling(false);
    }
  };

  const handlePrintReceipt = async (payment: PaymentItem) => {
    try {
      const paymentData = {
        ...payment,
        student: payment.student,
      };
      await generateReceiptPDF(paymentData, schoolSettings as Record<string, string>);
      window.print();
    } catch (err) {
      showError('Failed to generate receipt PDF');
    }
  };

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Payment History"
        subtitle="View, search, and print fee payment receipts"
        actions={
          <Button onClick={() => navigate('/payments/new')}>
            <Plus className="w-4 h-4 mr-1.5" /> Record Payment
          </Button>
        }
      />

      {/* Search Bar */}
      <div className="card p-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pl-10 w-full"
            placeholder="Search by receipt number, student name..."
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

      {/* Payments Table / Responsive Grid */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12">
            <LoadingSpinner message="Loading payments..." />
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            title="No payments recorded"
            description={search ? 'No payments matching your search criteria.' : 'Start by recording your first student fee payment.'}
            action={
              <Button onClick={() => navigate('/payments/new')}>
                <Plus className="w-4 h-4 mr-1.5" /> Record Payment
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
                      Receipt No
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Student
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Class & Sec
                    </th>
                    <th className="text-right p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="text-left p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">
                      Method
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
                  {payments.map((p) => {
                    const student = p.student;
                    const clsName = student?.class?.name ? `Class ${student.class.name}` : '-';
                    const secName = student?.section?.name ? ` (${student.section.name})` : '';

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                        onClick={() => setViewPayment(p)}
                      >
                        <td className="p-4 font-mono font-semibold text-xs text-primary-600 dark:text-primary-400">
                          {p.receiptNumber}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">
                          {formatDate(p.paymentDate)}
                        </td>
                        <td className="p-4 font-medium text-gray-900 dark:text-white">
                          <div>
                            <span>{student?.name || 'Unknown Student'}</span>
                            {student?.admissionNumber && (
                              <span className="block text-[11px] font-mono text-gray-400">
                                {student.admissionNumber}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">
                          {clsName}{secName}
                        </td>
                        <td className="p-4 text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                          {formatCurrency(p.amountPaise)}
                        </td>
                        <td className="p-4 text-gray-600 dark:text-gray-300">
                          <span className="px-2 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 font-medium">
                            {p.paymentMethod}
                          </span>
                        </td>
                        <td className="p-4">
                          <Badge variant={p.status === 'COMPLETED' ? 'success' : 'danger'}>
                            {p.status}
                          </Badge>
                        </td>
                        <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setViewPayment(p)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              title="View Receipt Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePrintReceipt(p)}
                              className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors"
                              title="Print / Download PDF Receipt"
                            >
                              <Printer className="w-4 h-4" />
                            </button>
                            {p.status === 'COMPLETED' && (
                              <button
                                type="button"
                                onClick={() => setCancelId(p.id)}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                title="Cancel Payment"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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

      {/* ── View Receipt Details Modal ────────────────────────────────────── */}
      <Modal
        isOpen={!!viewPayment}
        onClose={() => setViewPayment(null)}
        title="Fee Payment Receipt"
        size="lg"
      >
        {viewPayment && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-primary-500/10 via-emerald-500/10 to-transparent border border-primary-100 dark:border-primary-900/40">
              <div>
                <span className="text-xs text-gray-500 uppercase tracking-wider block">Receipt Number</span>
                <h3 className="font-mono font-bold text-lg text-primary-600 dark:text-primary-400">
                  {viewPayment.receiptNumber}
                </h3>
              </div>
              <div className="sm:text-right">
                <span className="text-xs text-gray-500 block">Date & Status</span>
                <div className="flex items-center sm:justify-end gap-2 mt-0.5">
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {formatDate(viewPayment.paymentDate)}
                  </span>
                  <Badge variant={viewPayment.status === 'COMPLETED' ? 'success' : 'danger'}>
                    {viewPayment.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Student & Payment Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Student Details Card */}
              <div className="card p-4 border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary-600" /> Student Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block">Student Name:</span>
                    <strong className="text-gray-900 dark:text-white">
                      {viewPayment.student?.name || 'N/A'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Admission Number:</span>
                    <span className="font-mono text-gray-700 dark:text-gray-300">
                      {viewPayment.student?.admissionNumber || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Class & Section:</span>
                    <span className="text-gray-700 dark:text-gray-300">
                      {viewPayment.student?.class?.name ? `Class ${viewPayment.student.class.name}` : '-'}
                      {viewPayment.student?.section?.name ? ` (${viewPayment.student.section.name})` : ''}
                    </span>
                  </div>
                  {viewPayment.student?.rollNumber && (
                    <div>
                      <span className="text-xs text-gray-400 block">Roll Number:</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {viewPayment.student.rollNumber}
                      </span>
                    </div>
                  )}
                </div>

                {viewPayment.student?.id && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const stuId = viewPayment.student?.id;
                      setViewPayment(null);
                      navigate(`/students/${stuId}?tab=fees`);
                    }}
                    className="mt-4 text-xs text-primary-600 hover:text-primary-700 p-0 h-auto"
                  >
                    <ExternalLink className="w-3 h-3 mr-1" /> Open Student Profile
                  </Button>
                )}
              </div>

              {/* Payment Details Card */}
              <div className="card p-4 border border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-800/30">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Payment Information
                </h4>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-xs text-gray-400 block">Amount Paid:</span>
                    <strong className="text-lg text-emerald-600 dark:text-emerald-400 font-bold">
                      {formatCurrency(viewPayment.amountPaise)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-xs text-gray-400 block">Payment Method:</span>
                    <span className="font-medium text-gray-700 dark:text-gray-300">
                      {viewPayment.paymentMethod}
                    </span>
                  </div>
                  {viewPayment.feeCategory?.name && (
                    <div>
                      <span className="text-xs text-gray-400 block">Fee Category:</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {viewPayment.feeCategory.name}
                      </span>
                    </div>
                  )}
                  {viewPayment.collectedBy?.fullName && (
                    <div>
                      <span className="text-xs text-gray-400 block">Collected By:</span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {viewPayment.collectedBy.fullName}
                      </span>
                    </div>
                  )}
                  {viewPayment.remarks && (
                    <div>
                      <span className="text-xs text-gray-400 block">Remarks / Notes:</span>
                      <p className="text-xs text-gray-600 dark:text-gray-400 italic">
                        {viewPayment.remarks}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons in Modal */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
              {viewPayment.status === 'COMPLETED' ? (
                <button
                  type="button"
                  onClick={() => {
                    setCancelId(viewPayment.id);
                  }}
                  className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 font-medium"
                >
                  <XCircle className="w-3.5 h-3.5" /> Cancel This Payment
                </button>
              ) : (
                <div />
              )}

              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={() => setViewPayment(null)}
                >
                  Close
                </Button>
                <Button
                  onClick={() => handlePrintReceipt(viewPayment)}
                  className="flex items-center gap-1.5"
                >
                  <Printer className="w-4 h-4" /> Print / PDF Receipt
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Cancel Payment Confirmation Dialog ────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancel}
        title="Cancel Payment"
        message="Are you sure you want to cancel this payment? This will mark the receipt as CANCELLED and update the student's fee balance."
        confirmText="Yes, Cancel Payment"
        loading={cancelling}
      />
    </div>
  );
}
