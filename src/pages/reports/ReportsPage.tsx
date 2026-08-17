import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner, StatCard } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { formatCurrency, apiCall } from '../../utils/helpers';
import { Download, Printer, FileSpreadsheet } from 'lucide-react';
import { exportToCSV } from '../../utils/export';

export default function ReportsPage() {
  const { academicYear } = useApp();
  const { error: showError } = useToast();
  const [activeReport, setActiveReport] = useState('daily');
  const [reportData, setReportData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const reportTypes = [
    { id: 'daily', label: 'Daily Collection', category: 'fees' },
    { id: 'monthly', label: 'Monthly Collection', category: 'fees' },
    { id: 'pending', label: 'Pending Fees', category: 'fees' },
    { id: 'classwise', label: 'Class-wise Fees', category: 'fees' },
    { id: 'student', label: 'Student Attendance', category: 'attendance' },
    { id: 'low', label: 'Low Attendance', category: 'attendance' },
  ];

  useEffect(() => { loadReport(activeReport); }, [activeReport, academicYear?.id]);

  const loadReport = async (type: string) => {
    setLoading(true);
    try {
      const rt = reportTypes.find(r => r.id === type);
      if (rt?.category === 'fees') {
        const data = await apiCall(() => window.api.fees.getReports(type, academicYear?.id));
        setReportData(data);
      } else if (rt?.category === 'attendance') {
        const data = await apiCall(() => window.api.attendance.getReport(type, { academicYearId: academicYear?.id, threshold: 75 }));
        setReportData(data);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!reportData || !Array.isArray(reportData)) return;
    exportToCSV(reportData as Record<string, unknown>[], [
      { header: 'Data', key: 'name' },
    ], `report-${activeReport}`);
  };

  return (
    <div>
      <PageHeader title="Reports" subtitle="Generate and export school reports" />

      <div className="flex flex-wrap gap-2 mb-6">
        {reportTypes.map(rt => (
          <Button key={rt.id} variant={activeReport === rt.id ? 'primary' : 'secondary'} size="sm" onClick={() => setActiveReport(rt.id)}>
            {rt.label}
          </Button>
        ))}
      </div>

      <div className="flex gap-2 mb-4">
        <Button variant="secondary" size="sm" onClick={handleExportCSV}><FileSpreadsheet className="w-4 h-4" /> Export CSV</Button>
        <Button variant="secondary" size="sm" onClick={() => window.print()}><Printer className="w-4 h-4" /> Print</Button>
      </div>

      {loading ? <LoadingSpinner /> : (
        <div className="card p-5" id="report-content">
          {activeReport === 'daily' && reportData && (
            <div>
              <h3 className="font-semibold mb-4">Daily Collection — Total: {formatCurrency((reportData as { totalPaise: number }).totalPaise)}</h3>
              <table className="w-full text-sm">
                <thead><tr className="border-b"><th className="text-left p-2">Receipt</th><th className="text-left p-2">Student</th><th className="text-right p-2">Amount</th></tr></thead>
                <tbody>
                  {((reportData as { payments: Record<string, unknown>[] }).payments || []).map((p, i) => (
                    <tr key={i} className="border-b border-gray-100">
                      <td className="p-2">{p.receiptNumber as string}</td>
                      <td className="p-2">{(p.student as { name: string })?.name}</td>
                      <td className="p-2 text-right">{formatCurrency(p.amountPaise as number)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeReport === 'monthly' && reportData && (
            <StatCard title="Monthly Collection" value={formatCurrency((reportData as { totalPaise: number }).totalPaise)} icon={<Download className="w-6 h-6" />} />
          )}

          {Array.isArray(reportData) && (
            <table className="w-full text-sm mt-4">
              <tbody>
                {reportData.map((row: Record<string, unknown>, i: number) => (
                  <tr key={i} className="border-b border-gray-100">
                    <td className="p-2">{JSON.stringify(row).slice(0, 200)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
