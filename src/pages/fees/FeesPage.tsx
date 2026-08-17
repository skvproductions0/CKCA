import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, StatCard } from '../../components/ui/Common';
import { formatCurrency, apiCall } from '../../utils/helpers';
import { CreditCard, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';

export default function FeesPage() {
  const { academicYear } = useApp();
  const { error: showError } = useToast();
  const [structures, setStructures] = useState<Record<string, unknown>[]>([]);
  const [pendingReport, setPendingReport] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, [academicYear?.id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [structs, pending] = await Promise.all([
        apiCall(() => window.api.fees.getStructures(academicYear?.id)),
        apiCall(() => window.api.fees.getReports('pending', academicYear?.id)),
      ]);
      setStructures(structs as Record<string, unknown>[]);
      setPendingReport(pending as Record<string, unknown>[]);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load fees');
    } finally {
      setLoading(false);
    }
  };

  const totalPending = pendingReport.reduce((s, p) => s + ((p.pendingPaise as number) || 0), 0);

  if (loading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Fee Management" subtitle="Fee structures and pending fees overview" />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="Fee Structures" value={structures.length} icon={<CreditCard className="w-6 h-6" />} />
        <StatCard title="Students with Pending" value={pendingReport.length} icon={<AlertTriangle className="w-6 h-6" />} color="bg-orange-50 text-orange-600" />
        <StatCard title="Total Pending" value={formatCurrency(totalPending)} icon={<TrendingUp className="w-6 h-6" />} color="bg-red-50 text-red-600" />
      </div>

      <div className="card p-5 mb-6">
        <h3 className="font-semibold mb-4 flex items-center gap-2"><BarChart3 className="w-5 h-5" /> Fee Structures</h3>
        {structures.length === 0 ? (
          <p className="text-sm text-gray-500">No fee structures defined. Create one in Settings.</p>
        ) : (
          <div className="space-y-3">
            {structures.map(s => {
              const cls = s.class as { name: string } | undefined;
              const items = s.items as { feeCategory: { name: string }; amountPaise: number }[];
              return (
                <div key={s.id as string} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium">{s.name as string}</h4>
                    <span className="font-bold">{formatCurrency(s.totalPaise as number)}</span>
                  </div>
                  {cls && <p className="text-xs text-gray-500 mb-2">Class {cls.name}</p>}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {items?.map((item, i) => (
                      <div key={i} className="text-xs">
                        <span className="text-gray-500">{item.feeCategory?.name}: </span>
                        <span className="font-medium">{formatCurrency(item.amountPaise)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="p-5 border-b"><h3 className="font-semibold">Pending Fees</h3></div>
        {pendingReport.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">All fees are paid!</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th className="text-left p-4">Student</th>
                <th className="text-left p-4">Class</th>
                <th className="text-left p-4">Section</th>
                <th className="text-right p-4">Total</th>
                <th className="text-right p-4">Paid</th>
                <th className="text-right p-4">Pending</th>
              </tr>
            </thead>
            <tbody>
              {pendingReport.map((p, i) => {
                const student = p.student as { name: string; class?: { name: string }; section?: { name: string } };
                return (
                  <tr key={i} className="border-t border-gray-100 dark:border-gray-800">
                    <td className="p-4 font-medium">{student?.name}</td>
                    <td className="p-4">{student?.class?.name || '-'}</td>
                    <td className="p-4">{student?.section?.name || '-'}</td>
                    <td className="p-4 text-right">{formatCurrency(p.totalPaise as number)}</td>
                    <td className="p-4 text-right text-green-600">{formatCurrency(p.paidPaise as number)}</td>
                    <td className="p-4 text-right text-orange-600 font-semibold">{formatCurrency(p.pendingPaise as number)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
