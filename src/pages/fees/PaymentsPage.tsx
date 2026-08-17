import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Eye, Printer, XCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, EmptyState, Badge, Pagination } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Modal';
import { formatCurrency, formatDate, apiCall } from '../../utils/helpers';

export default function PaymentsPage() {
  const { academicYear } = useApp();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const [payments, setPayments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => { loadPayments(); }, [search, page, academicYear?.id]);

  const loadPayments = async () => {
    setLoading(true);
    try {
      const result = await apiCall(() => window.api.fees.getPayments({
        search, academicYearId: academicYear?.id, page, limit: 20,
      })) as { payments: Record<string, unknown>[]; totalPages: number };
      setPayments(result.payments);
      setTotalPages(result.totalPages);
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
      success('Payment cancelled');
      setCancelId(null);
      loadPayments();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Payment History"
        subtitle="View and manage fee payments"
        actions={<Button onClick={() => navigate('/payments/new')}><Plus className="w-4 h-4" /> Record Payment</Button>}
      />

      <div className="card p-4 mb-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-10" placeholder="Search by receipt no or student..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? <LoadingSpinner /> : payments.length === 0 ? (
          <EmptyState title="No payments recorded" action={<Button onClick={() => navigate('/payments/new')}><Plus className="w-4 h-4" /> Record Payment</Button>} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="text-left p-4">Receipt No</th>
                    <th className="text-left p-4">Date</th>
                    <th className="text-left p-4">Student</th>
                    <th className="text-left p-4">Class</th>
                    <th className="text-left p-4">Section</th>
                    <th className="text-right p-4">Amount</th>
                    <th className="text-left p-4">Method</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-right p-4">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map(p => {
                    const student = p.student as { name: string; class?: { name: string }; section?: { name: string } };
                    return (
                      <tr key={p.id as string} className="border-t border-gray-100 dark:border-gray-800">
                        <td className="p-4 font-mono text-xs">{p.receiptNumber as string}</td>
                        <td className="p-4">{formatDate(p.paymentDate as string)}</td>
                        <td className="p-4 font-medium">{student?.name}</td>
                        <td className="p-4">{student?.class?.name || '-'}</td>
                        <td className="p-4">{student?.section?.name || '-'}</td>
                        <td className="p-4 text-right font-semibold">{formatCurrency(p.amountPaise as number)}</td>
                        <td className="p-4">{p.paymentMethod as string}</td>
                        <td className="p-4"><Badge variant={p.status === 'COMPLETED' ? 'success' : 'danger'}>{p.status as string}</Badge></td>
                        <td className="p-4">
                          <div className="flex justify-end gap-1">
                            <button className="p-1.5 rounded hover:bg-gray-100" title="View"><Eye className="w-4 h-4" /></button>
                            <button className="p-1.5 rounded hover:bg-gray-100" title="Print"><Printer className="w-4 h-4" /></button>
                            {p.status === 'COMPLETED' && (
                              <button onClick={() => setCancelId(p.id as string)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="Cancel"><XCircle className="w-4 h-4" /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="p-4"><Pagination page={page} totalPages={totalPages} onPageChange={setPage} /></div>
          </>
        )}
      </div>

      <ConfirmDialog
        isOpen={!!cancelId}
        onClose={() => setCancelId(null)}
        onConfirm={handleCancel}
        title="Cancel Payment"
        message="Are you sure you want to cancel this payment? This will update the student's fee balance."
        confirmText="Cancel Payment"
        loading={cancelling}
      />
    </div>
  );
}
