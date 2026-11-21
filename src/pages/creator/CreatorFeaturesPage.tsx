import { useState, useEffect } from 'react';
import {
  ToggleRight,
  Layers,
  School as SchoolIcon,
  Search,
  CheckCircle2,
  AlertTriangle,
  Users,
  Shield,
  Calendar,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { apiCall, formatDate } from '../../utils/helpers';
import { FeatureDefinition, PlanPreset, SchoolRecord } from '../../types';

interface SchoolFeaturesData {
  schoolId: string;
  schoolName: string;
  schoolCode: string;
  plan: string;
  maxStudents: number;
  maxStaff: number;
  licenseExpiresAt: string | null;
  licenseWarning: string | null;
  studentCount: number;
  staffCount: number;
  features: Record<string, boolean>;
  registry: FeatureDefinition[];
  presets: PlanPreset[];
}

export default function CreatorFeaturesPage() {
  const { success, error: showError } = useToast();

  const [schools, setSchools] = useState<SchoolRecord[]>([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
  const [featuresData, setFeaturesData] = useState<SchoolFeaturesData | null>(null);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [loadingFeatures, setLoadingFeatures] = useState(false);
  const [togglingFeatureId, setTogglingFeatureId] = useState<string | null>(null);
  const [applyingPlanId, setApplyingPlanId] = useState<string | null>(null);

  // Search & filter
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  // Limits form
  const [limitsForm, setLimitsForm] = useState({
    maxStudents: 1000,
    maxStaff: 100,
    licenseExpiresAt: '',
  });
  const [savingLimits, setSavingLimits] = useState(false);

  // Apply preset modal state
  const [planToApply, setPlanToApply] = useState<PlanPreset | null>(null);
  const [updateLimitsWithPreset, setUpdateLimitsWithPreset] = useState(true);

  useEffect(() => {
    loadSchools();
  }, []);

  useEffect(() => {
    if (selectedSchoolId) {
      loadSchoolFeatures(selectedSchoolId);
    }
  }, [selectedSchoolId]);

  const loadSchools = async () => {
    setLoadingSchools(true);
    try {
      const res = await apiCall(() => window.api.creator.schools.list({ limit: 100 }));
      const list = res.schools || [];
      setSchools(list);
      if (list.length > 0 && !selectedSchoolId) {
        setSelectedSchoolId(list[0].id);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load schools');
    } finally {
      setLoadingSchools(false);
    }
  };

  const loadSchoolFeatures = async (schoolId: string) => {
    setLoadingFeatures(true);
    try {
      const data = await apiCall(() => window.api.creator.features.get(schoolId));
      setFeaturesData(data);
      setLimitsForm({
        maxStudents: data.maxStudents,
        maxStaff: data.maxStaff,
        licenseExpiresAt: data.licenseExpiresAt
          ? new Date(data.licenseExpiresAt).toISOString().split('T')[0]
          : '',
      });
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load school features');
    } finally {
      setLoadingFeatures(false);
    }
  };

  const handleToggleFeature = async (featureId: string, currentEnabled: boolean) => {
    if (!selectedSchoolId) return;
    const nextState = !currentEnabled;
    setTogglingFeatureId(featureId);

    // Optimistic update
    setFeaturesData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        plan: 'CUSTOM',
        features: {
          ...prev.features,
          [featureId]: nextState,
        },
      };
    });

    try {
      await apiCall(() =>
        window.api.creator.features.toggle(selectedSchoolId, featureId, nextState)
      );
      success(
        `Feature "${featureId}" turned ${nextState ? 'ON' : 'OFF'} for ${
          featuresData?.schoolName || 'school'
        }.`
      );
    } catch (err) {
      // Revert optimistic update on error
      setFeaturesData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          features: {
            ...prev.features,
            [featureId]: currentEnabled,
          },
        };
      });
      showError(err instanceof Error ? err.message : 'Failed to update feature');
    } finally {
      setTogglingFeatureId(null);
    }
  };

  const handleConfirmApplyPlan = async () => {
    if (!selectedSchoolId || !planToApply) return;
    setApplyingPlanId(planToApply.id);
    try {
      const updated = await apiCall(() =>
        window.api.creator.features.applyPlan(
          selectedSchoolId,
          planToApply.id,
          updateLimitsWithPreset
        )
      );
      setFeaturesData(updated);
      setLimitsForm({
        maxStudents: updated.maxStudents,
        maxStaff: updated.maxStaff,
        licenseExpiresAt: updated.licenseExpiresAt
          ? new Date(updated.licenseExpiresAt).toISOString().split('T')[0]
          : '',
      });
      setPlanToApply(null);
      success(`Applied ${planToApply.name} to ${updated.schoolName}!`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to apply plan preset');
    } finally {
      setApplyingPlanId(null);
    }
  };

  const handleSaveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSchoolId) return;
    setSavingLimits(true);
    try {
      const updated = await apiCall(() =>
        window.api.creator.features.updateLimits(selectedSchoolId, {
          maxStudents: Number(limitsForm.maxStudents),
          maxStaff: Number(limitsForm.maxStaff),
          licenseExpiresAt: limitsForm.licenseExpiresAt || null,
        })
      );
      setFeaturesData(updated);
      success(`Limits updated for ${updated.schoolName}!`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to update school limits');
    } finally {
      setSavingLimits(false);
    }
  };

  const categories = [
    'ALL',
    'Core Academic',
    'Administration',
    'Finance',
    'Examinations & Grading',
    'System',
  ];

  const filteredRegistry = (featuresData?.registry || []).filter((feat) => {
    const matchesCat = selectedCategory === 'ALL' || feat.category === selectedCategory;
    const matchesQuery =
      feat.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feat.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      feat.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const selectedSchool = schools.find((s) => s.id === selectedSchoolId);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-white tracking-tight">Feature Toggles & Plans</h1>
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              Module Registry
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Enable or disable modules per school, manage subscription plan tiers, and set resource limits.
          </p>
        </div>

        {/* School Dropdown Selector */}
        <div className="flex items-center gap-3">
          <div className="relative min-w-[280px]">
            <select
              value={selectedSchoolId}
              onChange={(e) => setSelectedSchoolId(e.target.value)}
              disabled={loadingSchools}
              className="w-full bg-[#111827] border border-slate-700 text-white rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-amber-500 cursor-pointer"
            >
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.code}) - {s.status}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={() => selectedSchoolId && loadSchoolFeatures(selectedSchoolId)}
            disabled={loadingFeatures}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors"
            title="Refresh school settings"
          >
            <RefreshCw className={`w-4 h-4 ${loadingFeatures ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loadingFeatures && !featuresData ? (
        <div className="py-20 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-500" />
          <p className="text-sm">Loading school features & plan limits...</p>
        </div>
      ) : featuresData ? (
        <>
          {/* Active School Overview Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0">
                  <SchoolIcon className="w-6 h-6 text-amber-400" />
                </div>
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h2 className="text-lg font-bold text-white">{featuresData.schoolName}</h2>
                    <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                      {featuresData.schoolCode}
                    </span>
                    <span
                      className={`text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                        featuresData.plan === 'PREMIUM'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : featuresData.plan === 'STANDARD'
                          ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                          : featuresData.plan === 'BASIC'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      Plan: {featuresData.plan}
                    </span>
                    <span
                      className={`text-xs font-bold px-2 py-0.5 rounded ${
                        selectedSchool?.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-rose-500/10 text-rose-400'
                      }`}
                    >
                      {selectedSchool?.status || 'ACTIVE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Modules Active:{' '}
                    <span className="text-amber-400 font-semibold">
                      {Object.values(featuresData.features).filter(Boolean).length} /{' '}
                      {featuresData.registry.length}
                    </span>{' '}
                    • Students:{' '}
                    <span className="text-slate-200 font-semibold">
                      {featuresData.studentCount} / {featuresData.maxStudents}
                    </span>{' '}
                    • Staff Users:{' '}
                    <span className="text-slate-200 font-semibold">
                      {featuresData.staffCount} / {featuresData.maxStaff}
                    </span>
                  </p>
                </div>
              </div>

              {/* Expiry Pill */}
              <div className="flex items-center gap-3 bg-slate-900/80 px-4 py-2.5 rounded-lg border border-slate-800">
                <Calendar className="w-4 h-4 text-slate-400" />
                <div className="text-xs">
                  <span className="text-slate-400">Licence Expiry: </span>
                  <span
                    className={`font-semibold ${
                      featuresData.licenseExpiresAt ? 'text-amber-300' : 'text-slate-200'
                    }`}
                  >
                    {featuresData.licenseExpiresAt
                      ? formatDate(featuresData.licenseExpiresAt)
                      : 'Lifetime (No Expiry)'}
                  </span>
                </div>
              </div>
            </div>

            {/* Licence Expiry Alert Banner */}
            {featuresData.licenseWarning && (
              <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-amber-400" />
                <span>{featuresData.licenseWarning}</span>
              </div>
            )}
          </div>

          {/* Section: Plan Presets (1-Click Switchers) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-amber-400" />
                  Subscription Plan Presets
                </h3>
                <p className="text-xs text-slate-400">
                  Switch on a curated package of modules and resource allocations in one click.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {featuresData.presets.map((preset) => {
                const isActivePlan = featuresData.plan === preset.id;
                return (
                  <div
                    key={preset.id}
                    className={`relative rounded-xl p-5 border transition-all flex flex-col justify-between ${
                      isActivePlan
                        ? 'bg-[#1e1b4b]/40 border-indigo-500/60 shadow-lg shadow-indigo-500/10'
                        : 'bg-[#0f172a] border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                          {preset.badge}
                        </span>
                        {isActivePlan && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> Active Plan
                          </span>
                        )}
                      </div>

                      <h4 className="text-base font-bold text-white mb-1">{preset.name}</h4>
                      <p className="text-xs text-slate-400 mb-4">{preset.description}</p>

                      <div className="space-y-1.5 text-xs text-slate-300 mb-5">
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Enabled Modules</span>
                          <span className="font-semibold text-white">
                            {preset.features.length} / {featuresData.registry.length}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Student Capacity</span>
                          <span className="font-semibold text-white">{preset.maxStudents} Students</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-800/60">
                          <span className="text-slate-400">Staff User Limit</span>
                          <span className="font-semibold text-white">{preset.maxStaff} Staff</span>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => setPlanToApply(preset)}
                      disabled={isActivePlan || applyingPlanId === preset.id}
                      className={`w-full py-2.5 px-4 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                        isActivePlan
                          ? 'bg-slate-800/80 text-slate-500 cursor-default'
                          : 'bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-600/20'
                      }`}
                    >
                      {isActivePlan ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Current Plan
                        </>
                      ) : (
                        `Apply ${preset.name}`
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Section: Granular Feature Toggles & Registry */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ToggleRight className="w-5 h-5 text-amber-400" />
                  Module Registry & Feature Toggles
                </h3>
                <p className="text-xs text-slate-400">
                  Turn individual modules ON or OFF. Turning a module OFF hides it from sidebar and widgets and blocks API routes with 403.
                </p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search modules..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-[#111827] border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors font-semibold ${
                    selectedCategory === cat
                      ? 'bg-amber-500 text-slate-950 shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Modules Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-2">
              {filteredRegistry.map((feat) => {
                const isEnabled = featuresData.features[feat.id] !== false;
                const isToggling = togglingFeatureId === feat.id;

                return (
                  <div
                    key={feat.id}
                    className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      isEnabled
                        ? 'bg-slate-900/60 border-slate-800'
                        : 'bg-slate-950/70 border-slate-900 opacity-75'
                    }`}
                  >
                    <div className="space-y-1.5 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-white">{feat.name}</span>
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {feat.id}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-800/60 text-slate-400">
                          {feat.category}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 leading-relaxed">{feat.description}</p>
                      <div className="text-[11px] text-slate-500 flex items-center gap-2 pt-1">
                        <span>Route: {feat.navPath}</span>
                        <span>•</span>
                        <span>APIs: {feat.ipcPrefixes.join(', ')}</span>
                      </div>
                    </div>

                    {/* Toggle Switch */}
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 pt-0.5">
                      <button
                        onClick={() => handleToggleFeature(feat.id, isEnabled)}
                        disabled={isToggling}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                          isEnabled ? 'bg-amber-500' : 'bg-slate-700'
                        }`}
                        title={isEnabled ? 'Click to disable' : 'Click to enable'}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            isEnabled ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span
                        className={`text-[10px] font-bold uppercase tracking-wider ${
                          isEnabled ? 'text-emerald-400' : 'text-slate-500'
                        }`}
                      >
                        {isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </div>
                  </div>
                );
              })}

              {filteredRegistry.length === 0 && (
                <div className="col-span-2 py-10 text-center text-slate-500">
                  No modules match your current filter or search query.
                </div>
              )}
            </div>
          </div>

          {/* Section: Resource Limits & Expiry Control */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2 mb-1">
              <Shield className="w-5 h-5 text-amber-400" />
              School Resource Limits & Licence Control
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Enforce maximum student enrollment, staff account caps, and set hard licence expiry dates.
            </p>

            <form onSubmit={handleSaveLimits} className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Max Students Limit
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="number"
                    min="1"
                    max="100000"
                    value={limitsForm.maxStudents}
                    onChange={(e) =>
                      setLimitsForm({ ...limitsForm, maxStudents: Number(e.target.value) })
                    }
                    className="w-full bg-[#111827] border border-slate-700 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Current enrolled: {featuresData.studentCount} students
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Max Staff / Users Limit
                </label>
                <div className="relative">
                  <Shield className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={limitsForm.maxStaff}
                    onChange={(e) =>
                      setLimitsForm({ ...limitsForm, maxStaff: Number(e.target.value) })
                    }
                    className="w-full bg-[#111827] border border-slate-700 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-amber-500 font-mono"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Current staff accounts: {featuresData.staffCount} users
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Licence Expiry Date
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
                  <input
                    type="date"
                    value={limitsForm.licenseExpiresAt}
                    onChange={(e) =>
                      setLimitsForm({ ...limitsForm, licenseExpiresAt: e.target.value })
                    }
                    className="w-full bg-[#111827] border border-slate-700 text-white text-sm rounded-lg pl-9 pr-3 py-2.5 focus:outline-none focus:border-amber-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Leave empty for lifetime / unlimited access
                </p>
              </div>

              <div className="md:col-span-3 flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="submit"
                  disabled={savingLimits}
                  className="px-5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-amber-600/20 disabled:opacity-50"
                >
                  {savingLimits ? 'Saving Limits...' : 'Save Resource Limits'}
                </button>
              </div>
            </form>
          </div>
        </>
      ) : null}

      {/* Confirmation Modal: Apply Plan Preset */}
      {planToApply && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-700 rounded-xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center flex-shrink-0 text-amber-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Apply {planToApply.name}?</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  This will switch the active modules for{' '}
                  <strong className="text-slate-200">{featuresData?.schoolName}</strong> to the{' '}
                  {planToApply.name} specification ({planToApply.features.length} modules enabled).
                </p>
              </div>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-lg border border-slate-800 space-y-2 text-xs">
              <label className="flex items-start gap-2.5 cursor-pointer text-slate-200">
                <input
                  type="checkbox"
                  checked={updateLimitsWithPreset}
                  onChange={(e) => setUpdateLimitsWithPreset(e.target.checked)}
                  className="mt-0.5 rounded border-slate-700 bg-slate-800 text-amber-500 focus:ring-amber-500"
                />
                <span>
                  Also update resource limits to {planToApply.name} defaults ({planToApply.maxStudents}{' '}
                  students, {planToApply.maxStaff} staff)
                </span>
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPlanToApply(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApplyPlan}
                disabled={Boolean(applyingPlanId)}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded-lg transition-colors shadow-md shadow-amber-600/20 disabled:opacity-50"
              >
                {applyingPlanId ? 'Applying...' : 'Confirm & Apply Plan'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
