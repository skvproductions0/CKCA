import { useState, useEffect } from 'react';
import {
  Database,
  Plus,
  RefreshCw,
  RotateCcw,
  AlertTriangle,
  CheckCircle2,
  Lock,
  HardDrive,
  ShieldCheck,
  FileCode,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiCall, formatDateTime } from '../../utils/helpers';
import { BackupFileInfo } from '../../types';

export default function CreatorBackupPage() {
  const { success, error: showError } = useToast();

  const [backups, setBackups] = useState<BackupFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [backupLabel, setBackupLabel] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Restore Modal State
  const [restoreModal, setRestoreModal] = useState<BackupFileInfo | null>(null);
  const [creatorPassword, setCreatorPassword] = useState('');
  const [restoring, setRestoring] = useState(false);

  useEffect(() => {
    loadBackups();
  }, []);

  const loadBackups = async () => {
    setLoading(true);
    try {
      const data = await apiCall(() => window.api.creator.backup.list());
      setBackups(data || []);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to list database backups');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setCreating(true);
    try {
      const res = await apiCall(() =>
        window.api.creator.backup.create(backupLabel.trim() || 'manual')
      );
      success(`Backup created successfully: ${res.filename} (${res.sizeFormatted})`);
      setBackupLabel('');
      setShowCreateModal(false);
      await loadBackups();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create database backup');
    } finally {
      setCreating(false);
    }
  };

  const handleExecuteRestore = async () => {
    if (!restoreModal) return;
    if (!creatorPassword) {
      showError('Please enter your Creator root password to authorize restoration.');
      return;
    }

    setRestoring(true);
    try {
      const res = await apiCall(() =>
        window.api.creator.backup.restore(restoreModal.filePath, creatorPassword)
      );
      success(res.message || 'Database restored successfully!');
      setRestoreModal(null);
      setCreatorPassword('');
      await loadBackups();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to restore database');
    } finally {
      setRestoring(false);
    }
  };

  const totalBackupBytes = backups.reduce((acc, b) => acc + b.sizeBytes, 0);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Database Backup & Restore</h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Disaster Recovery & Snapshots
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manual snapshots, automated daily backups, and password-authenticated database restoration.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={loadBackups}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors border border-slate-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-amber-400' : ''}`} />
            Refresh
          </button>

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-amber-600/20"
          >
            <Plus className="w-4 h-4" /> Create Snapshot Now
          </button>
        </div>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Total Backups Available</p>
            <p className="text-2xl font-extrabold text-white mt-1">{backups.length}</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Stored in /backups folder</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Database className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Latest Snapshot</p>
            <p className="text-sm font-bold text-emerald-400 mt-1 truncate max-w-[200px]">
              {backups[0] ? backups[0].filename : 'None yet'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {backups[0] ? formatDateTime(backups[0].createdAt) : 'Ready to create'}
            </p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-4 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400">Storage Footprint</p>
            <p className="text-2xl font-extrabold text-indigo-400 mt-1">
              {(totalBackupBytes / (1024 * 1024)).toFixed(2)} MB
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">SQLite database backups</p>
          </div>
          <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <HardDrive className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Safety Information Box */}
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <p className="font-bold text-amber-300">Automated Restoration Safety Net</p>
          <p className="text-slate-300 leading-relaxed">
            Restoring any previous backup file will re-ask for your Creator root password (Security Rule 8).
            Before replacing the active database, the system will automatically create an emergency safety
            snapshot (<code className="text-amber-300">pre-restore-safety-*.db</code>) so your current state is never lost.
          </p>
        </div>
      </div>

      {/* Backups List Table */}
      <div className="bg-[#0f172a] border border-slate-800 rounded-xl overflow-hidden shadow-lg">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">Database Snapshot Archives</h3>
          <span className="text-xs text-slate-400">{backups.length} archives recorded</span>
        </div>

        {loading ? (
          <div className="py-16 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
            <p className="text-sm">Inspecting backup archives...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-[#111827] text-slate-400 uppercase font-semibold border-b border-slate-800">
                <tr>
                  <th className="p-4">Backup Filename</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">File Size</th>
                  <th className="p-4">Created Timestamp</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {backups.map((b) => (
                  <tr key={b.filename} className="hover:bg-slate-800/30 transition-colors">
                    {/* Filename */}
                    <td className="p-4">
                      <div className="flex items-center gap-2 font-mono font-semibold text-white text-xs">
                        <FileCode className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        <span className="truncate max-w-[320px]">{b.filename}</span>
                      </div>
                      <span className="block text-[10px] text-slate-500 truncate max-w-[350px] mt-0.5 font-mono">
                        {b.filePath}
                      </span>
                    </td>

                    {/* Type */}
                    <td className="p-4">
                      {b.isAutomatic ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                          Automated Daily
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          Manual Snapshot
                        </span>
                      )}
                    </td>

                    {/* File Size */}
                    <td className="p-4 font-mono font-semibold text-slate-300">
                      {b.sizeFormatted}
                    </td>

                    {/* Created Timestamp */}
                    <td className="p-4 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                      {formatDateTime(b.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="p-4 text-right">
                      <button
                        onClick={() => {
                          setRestoreModal(b);
                          setCreatorPassword('');
                        }}
                        className="px-3 py-1.5 bg-rose-600/15 hover:bg-rose-600 text-rose-300 hover:text-white rounded-lg text-xs font-bold transition-colors border border-rose-500/30 flex items-center gap-1.5 ml-auto"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Restore Database
                      </button>
                    </td>
                  </tr>
                ))}

                {backups.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-16 text-center text-slate-400">
                      <Database className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-500" />
                      <p className="text-sm font-medium">No database backups created yet.</p>
                      <button
                        onClick={() => setShowCreateModal(true)}
                        className="mt-3 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors inline-flex items-center gap-1.5"
                      >
                        <Plus className="w-3.5 h-3.5" /> Create First Backup
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Manual Backup Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Create Database Snapshot</h3>
                <p className="text-xs text-slate-400">
                  Captures a full binary copy of the active SQLite database.
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Snapshot Label / Description (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. pre-upgrade, monthly-audit, roll-over"
                value={backupLabel}
                onChange={(e) => setBackupLabel(e.target.value)}
                className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Will be included in the file name: <code className="text-slate-400 font-mono">backup-{backupLabel || 'manual'}-[timestamp].db</code>
              </p>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateBackup}
                disabled={creating}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5"
              >
                {creating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Database className="w-3.5 h-3.5" />}
                {creating ? 'Creating Snapshot...' : 'Save Backup'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Password Challenge Modal */}
      {restoreModal && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-rose-500/40 rounded-xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-11 h-11 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 flex-shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirm Dangerous Action: Database Restore</h3>
                <p className="text-xs text-rose-300">
                  Authorization required. This operation will overwrite active system data.
                </p>
              </div>
            </div>

            <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Target Backup:</span>
                <span className="font-mono font-bold text-white truncate max-w-[240px]">
                  {restoreModal.filename}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Archive Size:</span>
                <span className="font-mono text-slate-300">{restoreModal.sizeFormatted}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Archive Date:</span>
                <span className="font-mono text-slate-300">{formatDateTime(restoreModal.createdAt)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              To proceed, please enter your <strong className="text-white">Creator root password</strong>.
              An emergency pre-restore snapshot will be saved automatically prior to restoration.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Creator Password *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="password"
                  placeholder="Enter Creator password to verify"
                  value={creatorPassword}
                  onChange={(e) => setCreatorPassword(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && creatorPassword && handleExecuteRestore()}
                  className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-rose-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setRestoreModal(null);
                  setCreatorPassword('');
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteRestore}
                disabled={!creatorPassword || restoring}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 shadow-lg shadow-rose-600/30"
              >
                {restoring ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                {restoring ? 'Restoring Database...' : 'Authorize & Restore Database'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
