import { useState, useEffect } from 'react';
import {
  Clock,
  Save,
  Server,
  ShieldAlert,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiCall } from '../../utils/helpers';
import { SystemSettingsData } from '../../types';

export default function CreatorSettingsPage() {
  const { success, error: showError } = useToast();

  const [settings, setSettings] = useState<SystemSettingsData>({
    maintenanceMode: false,
    maintenanceMessage: 'The system is currently undergoing scheduled maintenance. Please try again shortly.',
    dailyBackupEnabled: true,
    dailyBackupTime: '02:00',
    backupRetentionDays: 30,
    lastDailyBackupAt: null,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await apiCall(() => window.api.creator.system.getSettings());
      if (data) setSettings(data);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load system settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const res = await apiCall(() =>
        window.api.creator.system.updateSettings({
          maintenanceMode: settings.maintenanceMode,
          maintenanceMessage: settings.maintenanceMessage.trim(),
          dailyBackupEnabled: settings.dailyBackupEnabled,
          dailyBackupTime: settings.dailyBackupTime,
          backupRetentionDays: Number(settings.backupRetentionDays),
        })
      );
      if (res) setSettings(res);
      success('System settings saved successfully!');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save system settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">System Control Settings</h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Global Governance
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Global system-wide maintenance mode, automated snapshot scheduling, and runtime configuration.
          </p>
        </div>

        <button
          onClick={handleSaveSettings}
          disabled={saving || loading}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-amber-600/20 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2 text-amber-500" />
          <p className="text-sm">Loading system settings...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Maintenance Mode Card */}
          <div
            className={`border rounded-xl p-6 transition-colors shadow-lg ${
              settings.maintenanceMode
                ? 'bg-rose-950/20 border-rose-500/40'
                : 'bg-[#0f172a] border-slate-800'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800/80">
              <div className="flex items-start gap-3">
                <div
                  className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    settings.maintenanceMode
                      ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    System-Wide Maintenance Mode
                    {settings.maintenanceMode && (
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                        LIVE ACTIVE
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    When enabled, all non-Creator users (Super Admins, Principals, Accountants, Teachers) are blocked from signing in or taking actions. Creator accounts remain operational.
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, maintenanceMode: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600"></div>
                <span className="ml-3 text-xs font-bold text-white">
                  {settings.maintenanceMode ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            {/* Custom message field */}
            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-slate-300">
                Custom Maintenance Notice (Displayed to Users)
              </label>
              <textarea
                rows={3}
                value={settings.maintenanceMessage}
                onChange={(e) =>
                  setSettings((prev) => ({ ...prev, maintenanceMessage: e.target.value }))
                }
                placeholder="Enter custom maintenance message..."
                className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg p-3 focus:outline-none focus:border-amber-500 font-sans leading-relaxed"
              />
              <p className="text-[11px] text-slate-500">
                Users attempting to login while maintenance mode is active will receive this exact notice.
              </p>
            </div>

            {/* Live Message Preview */}
            {settings.maintenanceMode && (
              <div className="mt-3 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 block mb-1">
                  Login Screen Preview:
                </span>
                <p className="text-rose-200 italic font-medium">"{settings.maintenanceMessage}"</p>
              </div>
            )}
          </div>

          {/* Automated Daily Backup Schedule Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 shadow-lg space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 flex-shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Automated Daily Backups</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Schedule automated database snapshots and set retention retention limits.
                  </p>
                </div>
              </div>

              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.dailyBackupEnabled}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, dailyBackupEnabled: e.target.checked }))
                  }
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                <span className="ml-3 text-xs font-bold text-white">
                  {settings.dailyBackupEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Daily Execution Time (24h format)
                </label>
                <input
                  type="time"
                  value={settings.dailyBackupTime}
                  onChange={(e) =>
                    setSettings((prev) => ({ ...prev, dailyBackupTime: e.target.value }))
                  }
                  disabled={!settings.dailyBackupEnabled}
                  className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Retention Window (Days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={settings.backupRetentionDays}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      backupRetentionDays: parseInt(e.target.value, 10) || 30,
                    }))
                  }
                  disabled={!settings.dailyBackupEnabled}
                  className="w-full bg-[#111827] border border-slate-700 text-white text-xs rounded-lg px-3 py-2.5 focus:outline-none focus:border-amber-500 disabled:opacity-50"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  Automatic backups older than {settings.backupRetentionDays} days will be safely pruned.
                </span>
              </div>
            </div>

            {settings.lastDailyBackupAt && (
              <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-xs flex items-center justify-between">
                <span className="text-slate-400">Last Automated Daily Run:</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {settings.lastDailyBackupAt}
                </span>
              </div>
            )}
          </div>

          {/* System Diagnostics Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Server className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">System Diagnostics & Environment</h3>
                <p className="text-xs text-slate-400">Underlying desktop framework and database runtime.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <span className="text-slate-500 text-[11px] block">Application</span>
                <span className="font-bold text-white mt-0.5 block">CK Career Academy</span>
              </div>
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <span className="text-slate-500 text-[11px] block">Engine</span>
                <span className="font-bold text-white mt-0.5 block">Electron + React 18</span>
              </div>
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <span className="text-slate-500 text-[11px] block">Database Engine</span>
                <span className="font-bold text-white mt-0.5 block">SQLite + Prisma ORM</span>
              </div>
              <div className="p-3 bg-[#111827] border border-slate-800 rounded-lg">
                <span className="text-slate-500 text-[11px] block">Architecture</span>
                <span className="font-bold text-emerald-400 mt-0.5 block">Multi-Tenant Root</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
