import { useEffect, useMemo, useState } from 'react';
import { FileText, CheckCircle2, ArrowLeft, ArrowRight, Save, X, Upload, Trash2, CircleAlert } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
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

function sanitizeText(value?: string) {
  return value ? value.trim() : '';
}

export default function NewAdmissionWizard({ onClose, onSuccess }: WizardProps) {
  const { academicYear, academicYears } = useApp();
  const { success, error: showError } = useToast();
  const [step, setStep] = useState<StepKey>(1);
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<{ id: string; name: string; sections: { id: string; name: string }[] }[]>([]);
  const [feeCategories, setFeeCategories] = useState<{ id: string; name: string }[]>([]);
  const [draftSaved, setDraftSaved] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<string | null>(null);
  const [documents, setDocuments] = useState<Array<{ id: string; name: string; filePath?: string; fileSize?: number; mimeType?: string; type: string }>>([]);
  const [stepErrors, setStepErrors] = useState<Record<string, string>>({});
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
    admissionStatus: 'PENDING',
    feeCategoryId: '',
    feeAmount: '0',
    discount: '0',
    paidAmount: '0',
    paymentMethod: 'CASH',
    paymentReference: '',
  });

  useEffect(() => { loadInitialData(); }, [academicYear?.id]);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      const [classData, feeData] = await Promise.all([
        apiCall(() => window.api.classes.list()),
        apiCall(() => window.api.fees.getCategories()),
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

  const selectedClass = useMemo(() => classes.find(c => c.id === form.classId), [classes, form.classId]);
  const feeTotal = Math.max(0, Number(form.feeAmount || 0) - Number(form.discount || 0));
  const balance = Math.max(0, feeTotal - Number(form.paidAmount || 0));

  const validateStep = (currentStep: StepKey) => {
    if (currentStep === 1) {
      if (!sanitizeText(form.fullName)) { showError('Full name is required.'); return false; }
      if (!form.dateOfBirth) { showError('Date of birth is required.'); return false; }
      if (!form.gender) { showError('Gender is required.'); return false; }
      const dob = new Date(form.dateOfBirth);
      if (Number.isNaN(dob.getTime())) { showError('Please enter a valid date of birth.'); return false; }
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
      if (!pincode) errors.pincode = 'PIN code is required.';

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

  const handleFileSelection = async () => {
    try {
      const result = await window.api.files.select([{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp'] }]);
      const filePath = (result as { data?: string } | { success?: boolean; error?: string }).data || (result as { success?: boolean; error?: string }).error;
      if (!filePath) return;
      const fileName = filePath.split(/[\\/]/).pop() || 'document';
      const fileMeta = { id: `${Date.now()}`, name: fileName, filePath, type: 'PHOTO', fileSize: 0, mimeType: 'image/jpeg' };
      setSelectedPhoto(filePath);
      setForm(prev => ({ ...prev, photoPath: filePath }));
      setDocuments(prev => prev.filter(doc => doc.type !== 'PHOTO').concat(fileMeta));
      success('Document selected');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to select document');
    }
  };

  const removePhoto = () => {
    setSelectedPhoto(null);
    setForm(prev => ({ ...prev, photoPath: '' }));
    setDocuments(prev => prev.filter(doc => doc.type !== 'PHOTO'));
  };

  const handleUploadDocument = async () => {
    try {
      const result = await window.api.files.select([{ name: 'Documents', extensions: ['pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'] }]);
      const filePath = (result as { data?: string } | { success?: boolean; error?: string }).data || (result as { success?: boolean; error?: string }).error;
      if (!filePath) return;
      const fileName = filePath.split(/[\\/]/).pop() || 'document';
      setDocuments(prev => [...prev, { id: `${Date.now()}`, name: fileName, filePath, type: 'OTHER' }]);
      success('Document uploaded');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to upload file');
    }
  };

  const removeDocument = (id: string) => setDocuments(prev => prev.filter(doc => doc.id !== id));

  const saveDraft = async () => {
    try {
      setLoading(true);
      const payload = { details: { fullName: sanitizeText(form.fullName), dateOfBirth: form.dateOfBirth, gender: form.gender, bloodGroup: form.bloodGroup, aadhaarNumber: sanitizeText(form.aadhaarNumber), previousSchool: sanitizeText(form.previousSchool), photoPath: form.photoPath }, parent: { fatherName: sanitizeText(form.fatherName), fatherMobile: sanitizeText(form.fatherMobile), fatherOccupation: sanitizeText(form.fatherOccupation), fatherEmail: sanitizeText(form.fatherEmail), motherName: sanitizeText(form.motherName), motherMobile: sanitizeText(form.motherMobile), motherOccupation: sanitizeText(form.motherOccupation), motherEmail: sanitizeText(form.motherEmail), guardianName: sanitizeText(form.guardianName), guardianMobile: sanitizeText(form.guardianMobile), guardianEmail: sanitizeText(form.guardianEmail), guardianRelation: sanitizeText(form.guardianRelation), address: sanitizeText(form.address), city: sanitizeText(form.city), state: sanitizeText(form.state), pincode: sanitizeText(form.pincode) }, academic: { academicYearId: form.academicYearId, classId: form.classId, sectionId: form.sectionId, rollNumber: sanitizeText(form.rollNumber), admissionDate: form.admissionDate, previousClass: sanitizeText(form.previousClass), tcNumber: sanitizeText(form.tcNumber), admissionStatus: form.admissionStatus }, documents, fee: { feeCategoryId: form.feeCategoryId, amount: Number(form.feeAmount || 0), discount: Number(form.discount || 0), paidAmount: Number(form.paidAmount || 0), paymentMethod: form.paymentMethod, paymentReference: sanitizeText(form.paymentReference) }, files: documents, draft: true };
      await apiCall(() => window.api.admissions.draft(payload));
      setDraftSaved(true);
      success('Draft saved successfully');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Unable to save draft');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    try {
      setLoading(true);
      const payload = { details: { fullName: sanitizeText(form.fullName), dateOfBirth: form.dateOfBirth, gender: form.gender, bloodGroup: form.bloodGroup, aadhaarNumber: sanitizeText(form.aadhaarNumber), previousSchool: sanitizeText(form.previousSchool), photoPath: form.photoPath }, parent: { fatherName: sanitizeText(form.fatherName), fatherMobile: sanitizeText(form.fatherMobile), fatherOccupation: sanitizeText(form.fatherOccupation), fatherEmail: sanitizeText(form.fatherEmail), motherName: sanitizeText(form.motherName), motherMobile: sanitizeText(form.motherMobile), motherOccupation: sanitizeText(form.motherOccupation), motherEmail: sanitizeText(form.motherEmail), guardianName: sanitizeText(form.guardianName), guardianMobile: sanitizeText(form.guardianMobile), guardianEmail: sanitizeText(form.guardianEmail), guardianRelation: sanitizeText(form.guardianRelation), address: sanitizeText(form.address), city: sanitizeText(form.city), state: sanitizeText(form.state), pincode: sanitizeText(form.pincode) }, academic: { academicYearId: form.academicYearId, classId: form.classId, sectionId: form.sectionId, rollNumber: sanitizeText(form.rollNumber), admissionDate: form.admissionDate, previousClass: sanitizeText(form.previousClass), tcNumber: sanitizeText(form.tcNumber), admissionStatus: form.admissionStatus }, documents, fee: { feeCategoryId: form.feeCategoryId, amount: Number(form.feeAmount || 0), discount: Number(form.discount || 0), paidAmount: Number(form.paidAmount || 0), paymentMethod: form.paymentMethod, paymentReference: sanitizeText(form.paymentReference) }, files: documents, remarks: 'Admission created from wizard' };
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
        return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <Input label="Full Name *" value={form.fullName} onChange={e => setForm(prev => ({ ...prev, fullName: e.target.value }))} /> <Input label="Date of Birth *" type="date" value={form.dateOfBirth} onChange={e => setForm(prev => ({ ...prev, dateOfBirth: e.target.value }))} /> <Select label="Gender *" options={GENDER_OPTIONS} placeholder="Select gender" value={form.gender} onChange={e => setForm(prev => ({ ...prev, gender: e.target.value }))} /> <Select label="Blood Group" options={BLOOD_GROUPS.map(b => ({ value: b, label: b }))} placeholder="Select" value={form.bloodGroup} onChange={e => setForm(prev => ({ ...prev, bloodGroup: e.target.value }))} /> <Input label="Aadhaar Number" value={form.aadhaarNumber} onChange={e => setForm(prev => ({ ...prev, aadhaarNumber: e.target.value }))} /> <Input label="Previous School" value={form.previousSchool} onChange={e => setForm(prev => ({ ...prev, previousSchool: e.target.value }))} /> <div className="md:col-span-2 rounded-xl border border-dashed border-gray-300 p-4"> <div className="flex items-center justify-between"> <div> <p className="font-medium">Student Photo</p> <p className="text-sm text-gray-500">Upload a passport-sized image for the student profile.</p> </div> <div className="flex gap-2"> {selectedPhoto ? <Button type="button" variant="secondary" onClick={removePhoto}><Trash2 className="w-4 h-4" /></Button> : <Button type="button" variant="secondary" onClick={handleFileSelection}><Upload className="w-4 h-4" /> Choose</Button>} </div> </div> {selectedPhoto ? <p className="mt-3 text-sm text-green-600">Selected: {selectedPhoto.split(/[\\/]/).pop()}</p> : <p className="mt-3 text-sm text-gray-500">No photo selected yet.</p>} </div></div>;
      case 2:
        return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <div className="md:col-span-2 text-sm text-gray-500">Provide at least one complete parent or guardian contact (name + mobile), and fill the address fields below.</div> {stepErrors._step && <p className="md:col-span-2 text-sm text-red-500">{stepErrors._step}</p>} <Input label="Father's Name" value={form.fatherName} error={stepErrors.fatherName} onChange={e => { setForm(prev => ({ ...prev, fatherName: e.target.value })); setStepErrors(prev => ({ ...prev, fatherName: undefined, _step: undefined })); }} /> <Input label="Father's Mobile" value={form.fatherMobile} error={stepErrors.fatherMobile} onChange={e => { setForm(prev => ({ ...prev, fatherMobile: e.target.value })); setStepErrors(prev => ({ ...prev, fatherMobile: undefined, _step: undefined })); }} /> <Input label="Father's Occupation" value={form.fatherOccupation} onChange={e => setForm(prev => ({ ...prev, fatherOccupation: e.target.value }))} /> <Input label="Father's Email" type="email" value={form.fatherEmail} onChange={e => setForm(prev => ({ ...prev, fatherEmail: e.target.value }))} /> <Input label="Mother's Name" value={form.motherName} error={stepErrors.motherName} onChange={e => { setForm(prev => ({ ...prev, motherName: e.target.value })); setStepErrors(prev => ({ ...prev, motherName: undefined, _step: undefined })); }} /> <Input label="Mother's Mobile" value={form.motherMobile} error={stepErrors.motherMobile} onChange={e => { setForm(prev => ({ ...prev, motherMobile: e.target.value })); setStepErrors(prev => ({ ...prev, motherMobile: undefined, _step: undefined })); }} /> <Input label="Mother's Occupation" value={form.motherOccupation} onChange={e => setForm(prev => ({ ...prev, motherOccupation: e.target.value }))} /> <Input label="Mother's Email" type="email" value={form.motherEmail} onChange={e => setForm(prev => ({ ...prev, motherEmail: e.target.value }))} /> <Input label="Guardian Name" value={form.guardianName} error={stepErrors.guardianName} onChange={e => { setForm(prev => ({ ...prev, guardianName: e.target.value })); setStepErrors(prev => ({ ...prev, guardianName: undefined, guardianRelation: undefined, _step: undefined })); }} /> <Input label="Guardian Mobile" value={form.guardianMobile} error={stepErrors.guardianMobile} onChange={e => { setForm(prev => ({ ...prev, guardianMobile: e.target.value })); setStepErrors(prev => ({ ...prev, guardianMobile: undefined, _step: undefined })); }} /> <Input label="Guardian Email" type="email" value={form.guardianEmail} onChange={e => setForm(prev => ({ ...prev, guardianEmail: e.target.value }))} /> <Input label="Relationship" value={form.guardianRelation} error={stepErrors.guardianRelation} onChange={e => { setForm(prev => ({ ...prev, guardianRelation: e.target.value })); setStepErrors(prev => ({ ...prev, guardianRelation: undefined })); }} /> <Input label="Address" className="md:col-span-2" value={form.address} error={stepErrors.address} onChange={e => { setForm(prev => ({ ...prev, address: e.target.value })); setStepErrors(prev => ({ ...prev, address: undefined })); }} /> <Input label="City" value={form.city} error={stepErrors.city} onChange={e => { setForm(prev => ({ ...prev, city: e.target.value })); setStepErrors(prev => ({ ...prev, city: undefined })); }} /> <Input label="State" value={form.state} error={stepErrors.state} onChange={e => { setForm(prev => ({ ...prev, state: e.target.value })); setStepErrors(prev => ({ ...prev, state: undefined })); }} /> <Input label="PIN Code" value={form.pincode} error={stepErrors.pincode} onChange={e => { setForm(prev => ({ ...prev, pincode: e.target.value })); setStepErrors(prev => ({ ...prev, pincode: undefined })); }} /></div>;
      case 3:case 3:
        return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <Select label="Academic Year *" options={academicYears.map(y => ({ value: y.id, label: y.name }))} placeholder="Select academic year" value={form.academicYearId} onChange={e => setForm(prev => ({ ...prev, academicYearId: e.target.value }))} /> <Select label="Class *" options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))} placeholder="Select class" value={form.classId} onChange={e => setForm(prev => ({ ...prev, classId: e.target.value, sectionId: '' }))} /> <Select label="Section" options={(selectedClass?.sections || []).map(s => ({ value: s.id, label: s.name }))} placeholder="Select section" value={form.sectionId} onChange={e => setForm(prev => ({ ...prev, sectionId: e.target.value }))} /> <Input label="Roll Number" value={form.rollNumber} onChange={e => setForm(prev => ({ ...prev, rollNumber: e.target.value }))} /> <Input label="Admission Date *" type="date" value={form.admissionDate} onChange={e => setForm(prev => ({ ...prev, admissionDate: e.target.value }))} /> <Input label="Previous Class" value={form.previousClass} onChange={e => setForm(prev => ({ ...prev, previousClass: e.target.value }))} /> <Input label="TC Number" value={form.tcNumber} onChange={e => setForm(prev => ({ ...prev, tcNumber: e.target.value }))} /> <Select label="Admission Status" options={[{ value: 'PENDING', label: 'Pending' }, { value: 'APPROVED', label: 'Approved' }, { value: 'REJECTED', label: 'Rejected' }, { value: 'ENROLLED', label: 'Enrolled' }]} placeholder="Select status" value={form.admissionStatus} onChange={e => setForm(prev => ({ ...prev, admissionStatus: e.target.value }))} /></div>;
      case 4:
        return <div className="space-y-4"> <div className="flex items-center justify-between"> <div><p className="font-medium">Supporting Documents</p><p className="text-sm text-gray-500">Attach birth certificate, Aadhaar, transfer certificate, and other documents.</p></div> <Button type="button" variant="secondary" onClick={handleUploadDocument}><Upload className="w-4 h-4" /> Upload</Button> </div> <div className="grid gap-3"> {documents.map(doc => <div key={doc.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3"> <div><p className="font-medium">{doc.name}</p><p className="text-xs text-gray-500">{doc.type}</p></div> <Button type="button" variant="ghost" onClick={() => removeDocument(doc.id)}><Trash2 className="w-4 h-4" /></Button></div>)} {documents.length === 0 && <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">No documents uploaded yet.</div>} </div></div>;
      case 5:
        return <div className="grid grid-cols-1 md:grid-cols-2 gap-4"> <Select label="Fee Category" options={feeCategories.map(c => ({ value: c.id, label: c.name }))} placeholder="Select fee category" value={form.feeCategoryId} onChange={e => setForm(prev => ({ ...prev, feeCategoryId: e.target.value }))} /> <Input label="Fee Amount" type="number" min="0" value={form.feeAmount} onChange={e => setForm(prev => ({ ...prev, feeAmount: e.target.value }))} /> <Input label="Discount" type="number" min="0" value={form.discount} onChange={e => setForm(prev => ({ ...prev, discount: e.target.value }))} /> <Input label="Initial Payment" type="number" min="0" value={form.paidAmount} onChange={e => setForm(prev => ({ ...prev, paidAmount: e.target.value }))} /> <Select label="Payment Method" options={PAYMENT_METHODS} placeholder="Select method" value={form.paymentMethod} onChange={e => setForm(prev => ({ ...prev, paymentMethod: e.target.value }))} /> <Input label="Payment Reference" value={form.paymentReference} onChange={e => setForm(prev => ({ ...prev, paymentReference: e.target.value }))} /> <div className="md:col-span-2 rounded-lg border border-gray-200 p-4 bg-gray-50"> <p className="font-semibold">Fee Summary</p> <p className="text-sm text-gray-600">Subtotal: ₹{Number(form.feeAmount || 0).toFixed(2)}</p> <p className="text-sm text-gray-600">Discount: ₹{Number(form.discount || 0).toFixed(2)}</p> <p className="text-sm text-gray-600">Total Payable: ₹{feeTotal.toFixed(2)}</p> <p className="text-sm text-gray-600">Initial Payment: ₹{Number(form.paidAmount || 0).toFixed(2)}</p> <p className="text-sm text-gray-600">Balance: ₹{balance.toFixed(2)}</p> </div></div>;
      case 6:
        return <div className="space-y-4"> <div className="rounded-lg border border-gray-200 p-4"> <p className="font-semibold text-lg">Review & Confirm</p> <div className="mt-3 grid gap-2 text-sm text-gray-600"> <p><span className="font-medium">Student:</span> {form.fullName || '-'}</p> <p><span className="font-medium">Admission No:</span> Will be generated automatically</p> <p><span className="font-medium">Academic:</span> {form.classId ? `Class ${classes.find(c => c.id === form.classId)?.name || ''}` : '-'} • {form.sectionId ? (selectedClass?.sections.find(s => s.id === form.sectionId)?.name || '') : '-'}</p> <p><span className="font-medium">Fee:</span> ₹{feeTotal.toFixed(2)} payable • ₹{Number(form.paidAmount || 0).toFixed(2)} paid</p> </div> </div> <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700"> <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5" /><span>The admission will be saved securely through the app backend.</span></div> </div> </div>;
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
            <div key={item.id} className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm ${step === item.id ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              <span className="font-medium">{item.id}. {item.title}</span>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-gray-200 p-4 bg-white">{renderStep()}</div>
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-gray-500">{draftSaved && <><CircleAlert className="w-4 h-4" /> Draft saved</>}</div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" type="button" onClick={onClose}><X className="w-4 h-4" /> Cancel</Button>
            <Button variant="secondary" type="button" onClick={saveDraft} loading={loading}><Save className="w-4 h-4" /> Save Draft</Button>
            {step > 1 && <Button variant="secondary" type="button" onClick={goPrev}><ArrowLeft className="w-4 h-4" /> Previous</Button>}
            {step < 6 ? <Button type="button" onClick={goNext}><ArrowRight className="w-4 h-4" /> Next</Button> : <Button type="button" onClick={handleConfirm} loading={loading}><CheckCircle2 className="w-4 h-4" /> Confirm Admission</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
