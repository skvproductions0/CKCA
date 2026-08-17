import { useState, useEffect } from 'react';
import { Database, Download, Upload, AlertTriangle } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/Modal';
import { formatDateTime, apiCall } from '../../utils/helpers';

export default function BackupPage() {
  const { success, error: showError } = useToast();
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [restorePath, setRestorePath] = useState('');
  const [auditLogs, setAuditLogs] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadAudit(); }, []);

  const loadAudit = async () => {
    try {
      const data = await apiCall(() => window.api.audit.list({ action: 'BACKUP', limit: 10 }));
      setAuditLogs((data as { logs: Record<string, unknown>[] }).logs);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    try {
      const path = await apiCall(() => window.api.backup.create());
      success(`Backup created: ${path}`);
      loadAudit();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Backup failed');
    } finally {
      setBackingUp(false);
    }
  };

  const handleSelectRestore = async () => {
    try {
      const path = await apiCall(() => window.api.backup.selectFile());
      if (path) {
        setRestorePath(path);
        setShowRestoreConfirm(true);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to select file');
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      await apiCall(() => window.api.backup.restore(restorePath));
      success('Database restored successfully. Please restart the application.');
      setShowRestoreConfirm(false);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Restore failed');
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div>
      <PageHeader title="Backup & Restore" subtitle="Protect your school data" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-green-100 text-green-600"><Download className="w-6 h-6" /></div>
            <div>
              <h3 className="font-semibold">Create Backup</h3>
              <p className="text-sm text-gray-500">Save a copy of your database</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Creates a file named <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">school-backup-YYYY-MM-DD.db</code>
          </p>
          <Button onClick={handleBackup} loading={backingUp}><Database className="w-4 h-4" /> Backup Database</Button>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-orange-100 text-orange-600"><Upload className="w-6 h-6" /></div>
            <div>
              <h3 className="font-semibold">Restore Backup</h3>
              <p className="text-sm text-gray-500">Replace database from backup file</p>
            </div>
          </div>
          <div className="flex items-start gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg mb-4">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">A safety backup will be created before restoring.</p>
          </div>
          <Button variant="secondary" onClick={handleSelectRestore}><Upload className="w-4 h-4" /> Select Backup File</Button>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="font-semibold mb-4">Recent Backup Activity</h3>
        {loading ? <LoadingSpinner /> : auditLogs.length === 0 ? (
          <p className="text-sm text-gray-500">No backup activity yet</p>
        ) : (
          <div className="space-y-2">
            {auditLogs.map(log => (
              <div key={log.id as string} className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-800 text-sm">
                <span>{log.details as string}</span>
                <span className="text-gray-500">{formatDateTime(log.createdAt as string)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        onClose={() => setShowRestoreConfirm(false)}
        onConfirm={handleRestore}
        title="Restore Database"
        message="This will replace the current database with the selected backup. A safety backup will be created first. Continue?"
        confirmText="Restore"
        variant="danger"
        loading={restoring}
      />
    </div>
  );
}
