import { useEffect, useMemo, useState, useRef } from 'react';
import { CheckCircle2, ArrowLeft, ArrowRight, Save, X, Upload, Trash2, CircleAlert, FileText } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { GENDER_OPTIONS, BLOOD_GROUPS, PAYMENT_METHODS, apiCall } from '../../utils/helpers';

interface WizardProps {
  onClose: () => void;
  onSuccess?: () => void;
}

type StepKey = 1 | 2 | 3 | 4 | 5 | 6;

interface StepItem {
  id: StepKey;
  title: string;
}

const STEPS: StepItem[] = [
  { id: 1, title: 'Student Details' },
  { id: 2, title: 'Parent / Guardian' },
  { id: 3, title: 'Academic Details' },
  { id: 4, title: 'Documents' },
  { id: 5, title: 'Fee Setup' },
  { id: 6, title: 'Review & Confirm' },
];

// Document type options grouped by person
const STUDENT_DOC_TYPES = [
  { value: 'STUDENT_AADHAAR', label: "Student's Aadhaar Card" },
  { value: 'BIRTH_CERTIFICATE', label: 'Birth Certificate' },
  { value: 'TRANSFER_CERTIFICATE', label: 'Transfer Certificate (TC)' },
  { value: 'MARK_SHEET', label: 'Previous Class Mark Sheet' },
  { value: 'PASSPORT_PHOTO', label: 'Passport Size Photo' },
  { value: 'CASTE_CERTIFICATE', label: 'Caste Certificate' },
  { value: 'INCOME_CERTIFICATE', label: 'Income Certificate' },
];

const PARENT_DOC_TYPES = [
  { value: 'FATHER_AADHAAR', label: "Father's Aadhaar Card" },
  { value: 'MOTHER_AADHAAR', label: "Mother's Aadhaar Card" },
  { value: 'GUARDIAN_AADHAAR', label: "Guardian's Aadhaar Card" },
  { value: 'PARENT_PAN', label: "Parent's PAN Card" },
  { value: 'PARENT_PHOTO', label: "Parent's Photo" },
  { value: 'ADDRESS_PROOF', label: 'Address Proof' },
  { value: 'INCOME_PROOF', label: 'Income Proof' },
];

const ALL_DOC_TYPES = [...STUDENT_DOC_TYPES, ...PARENT_DOC_TYPES, { value: 'OTHER', label: 'Other Document' }];

function sanitizeText(value?: string) {
  return value ? value.trim() : '';
}

function formatAadhaar(value: string) {
  // Remove non-digits
  const digits = value.replace(/\D/g, '');
  // Format as XXXX XXXX XXXX
  const parts = digits.match(/.{1,4}/g) || [];
  return parts.join(' ');
}

export default function NewAdmissionWizard({ onClose, onSuccess }: WizardProps) {
  const { academicYear, academicYears, refreshSettings } = useApp();
  const { success, error: showError } = useToast();
  const [step, setStep] = useState<StepKey>(1);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string; sections: { id: string; name: string }[] }[]>([]);
  const [feeCategories, setFeeCategories] = useState<{ id: string; name: string }[]>([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; filePath?: string; fileSize?: number; mimeType?: string; type: string; docLabel?: string }>>([]);
  const [stepErrors, setStepErrors] = useState<Record<string, string | undefined>>({});
  const [showAddYearModal, setShowAddYearModal] = useState(false);
  const [newYearForm, setNewYearForm] = useState({
    name: `${new Date().getFullYear()}-${String(new Date().getFullYear() + 1).slice(-2)}`,
    startDate: `${new Date().getFullYear()}-04-01`,
    endDate: `${new Date().getFullYear() + 1}-03-31`,
    isCurrent: true,
  });
  const [savingYear, setSavingYear] = useState(false);
  const [activeDocType, setActiveDocType] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    fullName: '',
    dateOfBirth: '',
    gender: '',
    bloodGroup: '',
    aadhaarNumber: '',
    previousSchool: '',
    photoPath: '',
    fatherName: '',
    fatherMobile: '',
    fatherOccupation: '',
    fatherEmail: '',
    motherName: '',
    motherMobile: '',
    motherOccupation: '',
    motherEmail: '',
    guardianName: '',
    guardianMobile: '',
    guardianEmail: '',
    guardianRelation: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    academicYearId: academicYear?.id || '',
    classId: '',
    sectionId: '',
    rollNumber: '',
    admissionDate: new Date().toISOString().split('T')[0],
    previousClass: '',
    tcNumber: '',
    admissionStatus: 'ENROLLED',
    feeCategoryId: '',
    feeAmount: '0',
    discount: '0',
    paidAmount: '0',
    paymentMethod: 'CASH',
    paymentReference: '',
  });

  useEffect(() => { loadInitialData(); }, []);

  useEffect(() => {
    if (!form.academicYearId && academicYears.length > 0) {
      const active = academicYears.find(y => y.isCurrent) || academicYears[0];
      if (active) setForm(prev => ({ ...prev, academicYearId: active.id }));
    }
  }, [academicYears, form.academicYearId]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [classData, feeData] = await Promise.all([
        apiCall(() => window.api.classes.list()),
        apiCall(() => window.api.fees.getCategories()),
        refreshSettings(),
      ]);
      setClasses(classData as typeof classes);
      setFeeCategories((feeData as { categories?: { id: string; name: string }[] }).categories || feeData as { id: string; name: string }[]);
      if (academicYear?.id) setForm(prev => ({ ...prev, academicYearId: academicYear.id }));
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to load admission form');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAcademicYear = async () => {
    if (!newYearForm.name.trim()) {
      showError('Please enter an academic year name (e.g. 2026-27).');
      return;
    }
    if (!newYearForm.startDate || !newYearForm.endDate) {
      showError('Please provide both start and end dates.');
      return;
    }
    setSavingYear(true);
    try {
      const created = await apiCall<{ id: string; name: string }>(async () => {
        const res = await window.api.academicYears.create({
          name: newYearForm.name.trim(),
          startDate: newYearForm.startDate,
          endDate: newYearForm.endDate,
          isCurrent: newYearForm.isCurrent,
        });
        return res as { success: boolean; data?: { id: string; name: string }; error?: string };
      });
      await refreshSettings();
      if (created?.id) {
        setForm(prev => ({ ...prev, academicYearId: created.id }));
      }
      setShowAddYearModal(false);
      success(`Academic Year ${newYearForm.name} created and selected!`);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to create academic year');
    } finally {
      setSavingYear(false);
    }
  };

  const selectedClass = useMemo(() => classes.find(c => c.id === form.classId), [classes, form.classId]);
  const feeTotal = Math.max(0, Number(form.feeAmount || 0) - Number(form.discount || 0));
  const balance = Math.max(0, feeTotal - Number(form.paidAmount || 0));

  // Strip spaces from aadhaar for validation
  const aadhaarDigitsOnly = form.aadhaarNumber.replace(/\D/g, '');

  const validateStep = (currentStep: StepKey) => {
    if (currentStep === 1) {
      if (!sanitizeText(form.fullName)) { showError('Full name is required.'); return false; }
      if (!form.dateOfBirth) { showError('Date of birth is required.'); return false; }
      if (!form.gender) { showError('Gender is required.'); return false; }
      const dob = new Date(form.dateOfBirth);
      if (Number.isNaN(dob.getTime())) { showError('Please enter a valid date of birth.'); return false; }
      if (aadhaarDigitsOnly && aadhaarDigitsOnly.length !== 12) {
        showError('Aadhaar number must be exactly 12 digits.');
        return false;
      }
      return true;
    }
    if (currentStep === 2) {
      const fatherName = sanitizeText(form.fatherName);
      const fatherMobile = sanitizeText(form.fatherMobile);
      const motherName = sanitizeText(form.motherName);
      const motherMobile = sanitizeText(form.motherMobile);
      const guardianName = sanitizeText(form.guardianName);
      const guardianMobile = sanitizeText(form.guardianMobile);
      const guardianRelation = sanitizeText(form.guardianRelation);
      const address = sanitizeText(form.address);
      const city = sanitizeText(form.city);
      const state = sanitizeText(form.state);
      const pincode = sanitizeText(form.pincode);

      const errors: Record<string, string> = {};
      if (!address) errors.address = 'Address is required.';
      if (!city) errors.city = 'City is required.';
      if (!state) errors.state = 'State is required.';
      if (!pincode) {
        errors.pincode = 'PIN code is required.';
      } else if (!/^\d{6}$/.test(pincode)) {
        errors.pincode = 'PIN code must be exactly 6 digits.';
      }
      if (fatherMobile && !/^\d{10}$/.test(fatherMobile)) errors.fatherMobile = 'Mobile must be 10 digits.';
      if (motherMobile && !/^\d{10}$/.test(motherMobile)) errors.motherMobile = 'Mobile must be 10 digits.';
      if (guardianMobile && !/^\d{10}$/.test(guardianMobile)) errors.guardianMobile = 'Mobile must be 10 digits.';

      const fatherComplete = fatherName && fatherMobile;
      const motherComplete = motherName && motherMobile;
      const guardianComplete = guardianName && guardianMobile;
      if (!fatherComplete && !motherComplete && !guardianComplete) {
        errors._step = 'Provide at least one complete parent or guardian contact (name + mobile).';
      }
      if (guardianName && !guardianRelation) {
        errors.guardianRelation = 'Guardian relationship is required when guardian name is provided.';
      }

      if (Object.keys(errors).length > 0) {
        setStepErrors(errors);
        showError('Please correct the highlighted fields and required contact details.');
        return false;
      }
      setStepErrors({});
      return true;
    }
    if (currentStep === 3) {
      if (!form.academicYearId) { showError('Academic year is required.'); return false; }
      if (!form.classId) { showError('Class is required.'); return false; }
      if (!form.admissionDate) { showError('Admission date is required.'); return false; }
      return true;
    }
    if (currentStep === 5) {
      if (Number(form.feeAmount) < 0 || Number(form.discount) < 0 || Number(form.paidAmount) < 0) { showError('Fees and payments cannot be negative.'); return false; }
      if (Number(form.paidAmount) > feeTotal) { showError('Initial payment cannot exceed the payable amount.'); return false; }
      return true;
    }
    return true;
  };

  const goNext = () => {
    if (!validateStep(step)) return;
    setStep(prev => (prev < 6 ? (prev + 1) as StepKey : prev));
  };

  const goPrev = () => setStep(prev => (prev > 1 ? (prev - 1) as StepKey : prev));

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setSelectedPhoto(dataUrl);
      setForm(prev => ({ ...prev, photoPath: dataUrl }));

      let savedPath = dataUrl;
      try {
        const buffer = await file.arrayBuffer();
        savedPath = await apiCall<string>(() => window.api.files.save(buffer, file.name, 'photos'));
      } catch {
        savedPath = dataUrl;
      }

      const fileMeta = {
        id: `${Date.now()}`,
        name: file.name,
        filePath: savedPath,
        type: 'PHOTO',
        fileSize: file.size,
        mimeType: file.type || 'image/jpeg',
      };
      setDocuments(prev => prev.filter(doc => doc.type !== 'PHOTO').concat(fileMeta));
      success('Photo uploaded & preview ready');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removePhoto = () => {
    setSelectedPhoto(null);
    setForm(prev => ({ ...prev, photoPath: '' }));
    setDocuments(prev => prev.filter(doc => doc.type !== 'PHOTO'));
  };

  const triggerUploadDoc = (docType: string) => {
    setActiveDocType(docType);
    docInputRef.current?.click();
  };

  const handleDocFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const docType = activeDocType;
    if (!file || !docType) return;
    const label = ALL_DOC_TYPES.find(d => d.value === docType)?.label || docType;

    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      try {
        const buffer = await file.arrayBuffer();
        await apiCall<string>(() => window.api.files.save(buffer, file.name, 'documents'));
      } catch {
        // saved in memory
      }

      setDocuments(prev => prev.filter(d => d.type !== docType).concat({
        id: `${Date.now()}`,
        name: file.name,
        filePath: dataUrl,
        type: docType,
        docLabel: label,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
      }));
      success(`${label} uploaded`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeDocument = (id: string) => setDocuments(prev => prev.filter(doc => doc.id !== id));

  const saveDraft = async () => {
    try {
      setLoading(true);
      const payload = buildPayload(true);
      await apiCall(() => window.api.admissions.draft(payload));
      setDraftSaved(true);
      success('Draft saved successfully');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to save draft');
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = (draft = false) => ({
    details: {
      fullName: sanitizeText(form.fullName),
      dateOfBirth: form.dateOfBirth,
      gender: form.gender,
      bloodGroup: form.bloodGroup,
      aadhaarNumber: aadhaarDigitsOnly, // always store raw digits
      previousSchool: sanitizeText(form.previousSchool),
      photoPath: form.photoPath,
    },
    parent: {
      fatherName: sanitizeText(form.fatherName),
      fatherMobile: sanitizeText(form.fatherMobile),
      fatherOccupation: sanitizeText(form.fatherOccupation),
      fatherEmail: sanitizeText(form.fatherEmail),
      motherName: sanitizeText(form.motherName),
      motherMobile: sanitizeText(form.motherMobile),
      motherOccupation: sanitizeText(form.motherOccupation),
      motherEmail: sanitizeText(form.motherEmail),
      guardianName: sanitizeText(form.guardianName),
      guardianMobile: sanitizeText(form.guardianMobile),
      guardianEmail: sanitizeText(form.guardianEmail),
      guardianRelation: sanitizeText(form.guardianRelation),
      address: sanitizeText(form.address),
      city: sanitizeText(form.city),
      state: sanitizeText(form.state),
      pincode: sanitizeText(form.pincode),
    },
    academic: {
      academicYearId: form.academicYearId,
      classId: form.classId,
      sectionId: form.sectionId,
      rollNumber: sanitizeText(form.rollNumber),
      admissionDate: form.admissionDate,
      previousClass: sanitizeText(form.previousClass),
      tcNumber: sanitizeText(form.tcNumber),
      admissionStatus: form.admissionStatus,
    },
    documents,
    fee: {
      feeCategoryId: form.feeCategoryId,
      amount: Number(form.feeAmount || 0),
      discount: Number(form.discount || 0),
      paidAmount: Number(form.paidAmount || 0),
      paymentMethod: form.paymentMethod,
      paymentReference: sanitizeText(form.paymentReference),
    },
    files: documents,
    draft,
    remarks: draft ? 'Draft saved' : 'Admission created from wizard',
  });

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const payload = buildPayload(false);
      await apiCall(() => window.api.admissions.wizard(payload));
      success('Admission completed successfully');
      onSuccess?.();
      onClose();
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Admission could not be completed');
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Full Name *" value={form.fullName} onChange={e => setForm(prev => ({ ...prev, fullName: e.target.value }))} />
            <Input label="Date of Birth *" type="date" value={form.dateOfBirth} onChange={e => setForm(prev => ({ ...prev, dateOfBirth: e.target.value }))} />
            <Select label="Gender *" options={GENDER_OPTIONS} placeholder="Select gender" value={form.gender} onChange={e => setForm(prev => ({ ...prev, gender: e.target.value }))} />
            <Select label="Blood Group" options={BLOOD_GROUPS.map(b => ({ value: b, label: b }))} placeholder="Select" value={form.bloodGroup} onChange={e => setForm(prev => ({ ...prev, bloodGroup: e.target.value }))} />

            {/* Aadhaar with 12-digit formatting */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Aadhaar Number <span className="text-gray-400 font-normal">(12 digits)</span>
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={14} // 12 digits + 2 spaces
                placeholder="XXXX XXXX XXXX"
                value={form.aadhaarNumber}
                onChange={e => {
                  const formatted = formatAadhaar(e.target.value);
                  setForm(prev => ({ ...prev, aadhaarNumber: formatted }));
                }}
                className={`input w-full font-mono tracking-widest ${aadhaarDigitsOnly.length > 0 && aadhaarDigitsOnly.length !== 12 ? 'border-red-400 focus:ring-red-400' : ''}`}
              />
              {aadhaarDigitsOnly.length > 0 && aadhaarDigitsOnly.length !== 12 && (
                <p className="text-xs text-red-500 mt-1">Aadhaar must be exactly 12 digits ({aadhaarDigitsOnly.length}/12)</p>
              )}
              {aadhaarDigitsOnly.length === 12 && (
                <p className="text-xs text-green-600 mt-1">✓ Valid Aadhaar number</p>
              )}
            </div>

            <Input label="Previous School" value={form.previousSchool} onChange={e => setForm(prev => ({ ...prev, previousSchool: e.target.value }))} />

            {/* Photo upload */}
            <div className="md:col-span-2 rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4 bg-gray-50 dark:bg-gray-800/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {selectedPhoto ? (
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-primary-500 shadow-sm flex-shrink-0 bg-white">
                      <img src={selectedPhoto} alt="Student Preview" className="w-full h-full object-cover" />
                    </div>
                  ) : null}
                  <div>
                    <p className="font-medium text-sm">Student Photo</p>
                    <p className="text-xs text-gray-500 mt-0.5">Upload a passport-sized photo for the student profile.</p>
                    {selectedPhoto ? (
                      <p className="text-xs text-green-600 font-medium mt-1">✓ Photo ready</p>
                    ) : (
                      <p className="text-xs text-gray-400 mt-1">No photo selected yet.</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {selectedPhoto
                    ? <Button type="button" variant="secondary" onClick={removePhoto}><Trash2 className="w-4 h-4" /> Remove</Button>
                    : <Button type="button" variant="secondary" onClick={() => photoInputRef.current?.click()}><Upload className="w-4 h-4" /> Choose Photo</Button>}
                </div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2">
              ℹ️ Provide at least one complete parent or guardian contact (name + mobile), and fill the address fields.
            </div>
            {stepErrors._step && <p className="md:col-span-2 text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{stepErrors._step}</p>}

            {/* Father */}
            <div className="md:col-span-2"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Father's Details</p></div>
            <Input label="Father's Name" value={form.fatherName} error={stepErrors.fatherName} onChange={e => { setForm(prev => ({ ...prev, fatherName: e.target.value })); setStepErrors(prev => ({ ...prev, fatherName: undefined, _step: undefined })); }} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Father's Mobile</label>
              <input
                type="text" inputMode="numeric" maxLength={10}
                placeholder="10-digit mobile number"
                value={form.fatherMobile}
                onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setForm(prev => ({ ...prev, fatherMobile: v })); setStepErrors(prev => ({ ...prev, fatherMobile: undefined, _step: undefined })); }}
                className={`input w-full ${stepErrors.fatherMobile ? 'border-red-400' : ''}`}
              />
              {stepErrors.fatherMobile && <p className="text-xs text-red-500 mt-1">{stepErrors.fatherMobile}</p>}
              {form.fatherMobile.length > 0 && form.fatherMobile.length < 10 && <p className="text-xs text-orange-500 mt-1">{form.fatherMobile.length}/10 digits</p>}
            </div>
            <Input label="Father's Occupation" value={form.fatherOccupation} onChange={e => setForm(prev => ({ ...prev, fatherOccupation: e.target.value }))} />
            <Input label="Father's Email" type="email" value={form.fatherEmail} onChange={e => setForm(prev => ({ ...prev, fatherEmail: e.target.value }))} />

            {/* Mother */}
            <div className="md:col-span-2"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2">Mother's Details</p></div>
            <Input label="Mother's Name" value={form.motherName} error={stepErrors.motherName} onChange={e => { setForm(prev => ({ ...prev, motherName: e.target.value })); setStepErrors(prev => ({ ...prev, motherName: undefined, _step: undefined })); }} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mother's Mobile</label>
              <input
                type="text" inputMode="numeric" maxLength={10}
                placeholder="10-digit mobile number"
                value={form.motherMobile}
                onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setForm(prev => ({ ...prev, motherMobile: v })); setStepErrors(prev => ({ ...prev, motherMobile: undefined, _step: undefined })); }}
                className={`input w-full ${stepErrors.motherMobile ? 'border-red-400' : ''}`}
              />
              {stepErrors.motherMobile && <p className="text-xs text-red-500 mt-1">{stepErrors.motherMobile}</p>}
              {form.motherMobile.length > 0 && form.motherMobile.length < 10 && <p className="text-xs text-orange-500 mt-1">{form.motherMobile.length}/10 digits</p>}
            </div>
            <Input label="Mother's Occupation" value={form.motherOccupation} onChange={e => setForm(prev => ({ ...prev, motherOccupation: e.target.value }))} />
            <Input label="Mother's Email" type="email" value={form.motherEmail} onChange={e => setForm(prev => ({ ...prev, motherEmail: e.target.value }))} />

            {/* Guardian */}
            <div className="md:col-span-2"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2">Guardian Details <span className="font-normal text-gray-400">(if applicable)</span></p></div>
            <Input label="Guardian Name" value={form.guardianName} error={stepErrors.guardianName} onChange={e => { setForm(prev => ({ ...prev, guardianName: e.target.value })); setStepErrors(prev => ({ ...prev, guardianName: undefined, guardianRelation: undefined, _step: undefined })); }} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Guardian Mobile</label>
              <input
                type="text" inputMode="numeric" maxLength={10}
                placeholder="10-digit mobile number"
                value={form.guardianMobile}
                onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); setForm(prev => ({ ...prev, guardianMobile: v })); setStepErrors(prev => ({ ...prev, guardianMobile: undefined, _step: undefined })); }}
                className={`input w-full ${stepErrors.guardianMobile ? 'border-red-400' : ''}`}
              />
              {stepErrors.guardianMobile && <p className="text-xs text-red-500 mt-1">{stepErrors.guardianMobile}</p>}
              {form.guardianMobile.length > 0 && form.guardianMobile.length < 10 && <p className="text-xs text-orange-500 mt-1">{form.guardianMobile.length}/10 digits</p>}
            </div>
            <Input label="Guardian Email" type="email" value={form.guardianEmail} onChange={e => setForm(prev => ({ ...prev, guardianEmail: e.target.value }))} />
            <Input label="Relationship with Student" value={form.guardianRelation} error={stepErrors.guardianRelation} onChange={e => { setForm(prev => ({ ...prev, guardianRelation: e.target.value })); setStepErrors(prev => ({ ...prev, guardianRelation: undefined })); }} />

            {/* Address */}
            <div className="md:col-span-2"><p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 mt-2">Address</p></div>
            <Input label="Address *" className="md:col-span-2" value={form.address} error={stepErrors.address} onChange={e => { setForm(prev => ({ ...prev, address: e.target.value })); setStepErrors(prev => ({ ...prev, address: undefined })); }} />
            <Input label="City *" value={form.city} error={stepErrors.city} onChange={e => { setForm(prev => ({ ...prev, city: e.target.value })); setStepErrors(prev => ({ ...prev, city: undefined })); }} />
            <Input label="State *" value={form.state} error={stepErrors.state} onChange={e => { setForm(prev => ({ ...prev, state: e.target.value })); setStepErrors(prev => ({ ...prev, state: undefined })); }} />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">PIN Code *</label>
              <input
                type="text" inputMode="numeric" maxLength={6}
                placeholder="6-digit PIN code"
                value={form.pincode}
                onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setForm(prev => ({ ...prev, pincode: v })); setStepErrors(prev => ({ ...prev, pincode: undefined })); }}
                className={`input w-full font-mono ${stepErrors.pincode ? 'border-red-400' : ''}`}
              />
              {stepErrors.pincode && <p className="text-xs text-red-500 mt-1">{stepErrors.pincode}</p>}
              {form.pincode.length > 0 && form.pincode.length < 6 && <p className="text-xs text-orange-500 mt-1">{form.pincode.length}/6 digits</p>}
              {form.pincode.length === 6 && <p className="text-xs text-green-600 mt-1">✓ Valid PIN code</p>}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Academic Year *</label>
                <button type="button" onClick={() => setShowAddYearModal(true)} className="text-xs text-primary-600 hover:text-primary-700 font-medium underline">
                  + Add New Year
                </button>
              </div>
              <Select
                options={academicYears.map(y => ({ value: y.id, label: y.isCurrent ? `${y.name} (Current)` : y.name }))}
                placeholder={academicYears.length === 0 ? "No years found — Click '+ Add New Year'" : "Select academic year"}
                value={form.academicYearId}
                onChange={e => setForm(prev => ({ ...prev, academicYearId: e.target.value }))}
              />
            </div>
            <Select
              label="Class *"
              options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))}
              placeholder="Select class"
              value={form.classId}
              onChange={e => setForm(prev => ({ ...prev, classId: e.target.value, sectionId: '' }))}
            />

            {/* Section — shows hint when no class selected */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Section</label>
              {!form.classId ? (
                <div className="input text-gray-400 text-sm flex items-center bg-gray-50 dark:bg-gray-800 cursor-not-allowed select-none">
                  ← Select a class first
                </div>
              ) : (selectedClass?.sections || []).length === 0 ? (
                <div className="input text-gray-400 text-sm flex items-center bg-gray-50 dark:bg-gray-800">
                  No sections in this class
                </div>
              ) : (
                <Select
                  options={(selectedClass?.sections || []).map(s => ({ value: s.id, label: s.name }))}
                  placeholder="Select section"
                  value={form.sectionId}
                  onChange={e => setForm(prev => ({ ...prev, sectionId: e.target.value }))}
                />
              )}
            </div>

            <Input label="Roll Number" value={form.rollNumber} onChange={e => setForm(prev => ({ ...prev, rollNumber: e.target.value }))} />
            <Input label="Admission Date *" type="date" value={form.admissionDate} onChange={e => setForm(prev => ({ ...prev, admissionDate: e.target.value }))} />
            <Input label="Previous Class" value={form.previousClass} onChange={e => setForm(prev => ({ ...prev, previousClass: e.target.value }))} />
            <Input label="TC Number" value={form.tcNumber} onChange={e => setForm(prev => ({ ...prev, tcNumber: e.target.value }))} />
            <Select
              label="Admission Status"
              options={[
                { value: 'PENDING', label: 'Pending' },
                { value: 'APPROVED', label: 'Approved' },
                { value: 'REJECTED', label: 'Rejected' },
                { value: 'ENROLLED', label: 'Enrolled' },
              ]}
              placeholder="Select status"
              value={form.admissionStatus}
              onChange={e => setForm(prev => ({ ...prev, admissionStatus: e.target.value }))}
            />
          </div>
        );

      case 4:
        return (
          <div className="space-y-5">
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Upload Documents</p>
              <p className="text-sm text-gray-500 mt-0.5">Upload documents for the student and parents/guardian. Select the document type and then choose the file.</p>
            </div>

            {/* Document type groups */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Student documents */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <p className="font-medium text-sm text-blue-700 dark:text-blue-400">Student Documents</p>
                </div>
                <div className="space-y-2">
                  {STUDENT_DOC_TYPES.map(docType => {
                    const uploaded = documents.find(d => d.type === docType.value);
                    return (
                      <div key={docType.value} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{docType.label}</span>
                        {uploaded ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 max-w-[120px] truncate">{uploaded.name}</span>
                            <button onClick={() => removeDocument(uploaded.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => triggerUploadDoc(docType.value)}
                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            <Upload className="w-3 h-3" /> Upload
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Parent documents */}
              <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-7 h-7 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 text-purple-600" />
                  </div>
                  <p className="font-medium text-sm text-purple-700 dark:text-purple-400">Parent / Guardian Documents</p>
                </div>
                <div className="space-y-2">
                  {PARENT_DOC_TYPES.map(docType => {
                    const uploaded = documents.find(d => d.type === docType.value);
                    return (
                      <div key={docType.value} className="flex items-center justify-between py-1.5 border-b border-gray-100 dark:border-gray-800 last:border-0">
                        <span className="text-sm text-gray-700 dark:text-gray-300">{docType.label}</span>
                        {uploaded ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-green-600 max-w-[120px] truncate">{uploaded.name}</span>
                            <button onClick={() => removeDocument(uploaded.id)} className="text-red-400 hover:text-red-600">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => triggerUploadDoc(docType.value)}
                            className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
                          >
                            <Upload className="w-3 h-3" /> Upload
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Other / extra documents */}
            <div className="rounded-xl border border-dashed border-gray-300 dark:border-gray-600 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Other Documents</p>
                <button
                  type="button"
                  onClick={() => triggerUploadDoc('OTHER')}
                  className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  <Upload className="w-3.5 h-3.5" /> Add Other Document
                </button>
              </div>
              {documents.filter(d => d.type === 'OTHER').length > 0 ? (
                <div className="space-y-1">
                  {documents.filter(d => d.type === 'OTHER').map(doc => (
                    <div key={doc.id} className="flex items-center justify-between py-1.5">
                      <span className="text-sm text-gray-600">{doc.name}</span>
                      <button onClick={() => removeDocument(doc.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No other documents added yet.</p>
              )}
            </div>

            {/* Summary */}
            {documents.length > 0 && (
              <div className="rounded-lg bg-green-50 dark:bg-green-900/20 px-4 py-2 text-sm text-green-700 dark:text-green-400">
                ✓ {documents.length} document{documents.length !== 1 ? 's' : ''} attached
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="Fee Category" options={feeCategories.map(c => ({ value: c.id, label: c.name }))} placeholder="Select fee category" value={form.feeCategoryId} onChange={e => setForm(prev => ({ ...prev, feeCategoryId: e.target.value }))} />
            <Input label="Fee Amount (₹)" type="number" min="0" value={form.feeAmount} onChange={e => setForm(prev => ({ ...prev, feeAmount: e.target.value }))} />
            <Input label="Discount (₹)" type="number" min="0" value={form.discount} onChange={e => setForm(prev => ({ ...prev, discount: e.target.value }))} />
            <Input label="Initial Payment (₹)" type="number" min="0" value={form.paidAmount} onChange={e => setForm(prev => ({ ...prev, paidAmount: e.target.value }))} />
            <Select label="Payment Method" options={PAYMENT_METHODS} placeholder="Select method" value={form.paymentMethod} onChange={e => setForm(prev => ({ ...prev, paymentMethod: e.target.value }))} />
            <Input label="Payment Reference / Receipt No" value={form.paymentReference} onChange={e => setForm(prev => ({ ...prev, paymentReference: e.target.value }))} />
            <div className="md:col-span-2 rounded-lg border border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-800/50">
              <p className="font-semibold text-sm mb-2">Fee Summary</p>
              <div className="grid grid-cols-2 gap-1 text-sm text-gray-600 dark:text-gray-400">
                <span>Subtotal:</span><span className="text-right">₹{Number(form.feeAmount || 0).toFixed(2)}</span>
                <span>Discount:</span><span className="text-right text-green-600">- ₹{Number(form.discount || 0).toFixed(2)}</span>
                <span className="font-medium text-gray-800 dark:text-white">Total Payable:</span><span className="text-right font-medium text-gray-800 dark:text-white">₹{feeTotal.toFixed(2)}</span>
                <span>Initial Payment:</span><span className="text-right text-blue-600">₹{Number(form.paidAmount || 0).toFixed(2)}</span>
                <span className="font-medium">Balance Due:</span><span className={`text-right font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>₹{balance.toFixed(2)}</span>
              </div>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-4">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-5">
              <p className="font-semibold text-lg mb-4">Review & Confirm</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Student</p>
                  <p><span className="text-gray-500">Name:</span> {form.fullName || '-'}</p>
                  <p><span className="text-gray-500">DOB:</span> {form.dateOfBirth || '-'}</p>
                  <p><span className="text-gray-500">Gender:</span> {form.gender || '-'}</p>
                  {aadhaarDigitsOnly && <p><span className="text-gray-500">Aadhaar:</span> {form.aadhaarNumber}</p>}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Academic</p>
                  <p><span className="text-gray-500">Class:</span> {form.classId ? `Class ${classes.find(c => c.id === form.classId)?.name || ''}` : '-'}</p>
                  <p><span className="text-gray-500">Section:</span> {form.sectionId ? (selectedClass?.sections.find(s => s.id === form.sectionId)?.name || '-') : '-'}</p>
                  <p><span className="text-gray-500">Admission No:</span> Auto-generated</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Fees</p>
                  <p><span className="text-gray-500">Total Payable:</span> ₹{feeTotal.toFixed(2)}</p>
                  <p><span className="text-gray-500">Paid:</span> ₹{Number(form.paidAmount || 0).toFixed(2)}</p>
                  <p><span className="text-gray-500">Balance:</span> ₹{balance.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-2">Documents</p>
                  <p>{documents.length} document{documents.length !== 1 ? 's' : ''} attached</p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 dark:bg-green-900/20 p-4 text-sm text-green-700 dark:text-green-400">
              <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /><span>The admission will be saved securely. Admission number will be generated automatically.</span></div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (loading && !classes.length && !feeCategories.length) return <LoadingSpinner message="Preparing admission wizard..." />;

  return (
    <div className="space-y-6">
      <PageHeader title="New Admission" subtitle="Create a student admission with documents, fee setup, and review" />
      <div className="card p-5">
        <div className="flex flex-wrap gap-2 mb-6">
          {STEPS.map(item => (
            <div key={item.id} className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-colors ${step === item.id ? 'bg-primary-600 text-white' : step > item.id ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
              {step > item.id ? <CheckCircle2 className="w-3.5 h-3.5" /> : <span className="w-4 h-4 text-xs font-bold flex items-center justify-center">{item.id}</span>}
              <span className="font-medium">{item.title}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-900">{renderStep()}</div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">{draftSaved && <><CircleAlert className="w-4 h-4" /> Draft saved</>}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={onClose}><X className="w-4 h-4" /> Cancel</Button>
            <Button variant="secondary" type="button" onClick={saveDraft} loading={loading}><Save className="w-4 h-4" /> Save Draft</Button>
            {step > 1 && <Button variant="secondary" type="button" onClick={goPrev}><ArrowLeft className="w-4 h-4" /> Previous</Button>}
            {step < 6
              ? <Button type="button" onClick={goNext}><ArrowRight className="w-4 h-4" /> Next</Button>
              : <Button type="button" onClick={handleConfirm} loading={loading}><CheckCircle2 className="w-4 h-4" /> Confirm Admission</Button>}
          </div>
        </div>
      </div>

      <Modal isOpen={showAddYearModal} onClose={() => setShowAddYearModal(false)} title="Add Academic Year" size="md">
        <div className="space-y-4">
          <Input label="Academic Year Name *" placeholder="e.g. 2026-27" value={newYearForm.name} onChange={e => setNewYearForm(prev => ({ ...prev, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date *" type="date" value={newYearForm.startDate} onChange={e => setNewYearForm(prev => ({ ...prev, startDate: e.target.value }))} />
            <Input label="End Date *" type="date" value={newYearForm.endDate} onChange={e => setNewYearForm(prev => ({ ...prev, endDate: e.target.value }))} />
          </div>
          <label className="flex items-center gap-2 text-sm cursor-pointer pt-1">
            <input type="checkbox" checked={newYearForm.isCurrent} onChange={e => setNewYearForm(prev => ({ ...prev, isCurrent: e.target.checked }))} className="rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
            <span>Set as Active / Current Academic Year</span>
          </label>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-100 dark:border-gray-700">
            <Button variant="secondary" type="button" onClick={() => setShowAddYearModal(false)}>Cancel</Button>
            <Button type="button" onClick={handleCreateAcademicYear} loading={savingYear}>Save & Select</Button>
          </div>
        </div>
      </Modal>
      {/* Hidden file inputs for photo and document uploads */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoFileChange}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={handleDocFileChange}
      />
    </div>
  );
}
