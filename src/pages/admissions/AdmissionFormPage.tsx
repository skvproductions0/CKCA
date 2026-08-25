import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Upload,
  Trash2,
  Eye,
  FileText,
  Save,
  CheckCircle2,
  Download,
  Plus,
  Wallet,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { GENDER_OPTIONS, BLOOD_GROUPS, PAYMENT_METHODS, apiCall } from '../../utils/helpers';

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

function formatAadhaar(value: string) {
  const digits = value.replace(/\D/g, '');
  const parts = digits.match(/.{1,4}/g) || [];
  return parts.join(' ');
}

interface DocItem {
  id: string;
  name: string;
  type: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  docLabel?: string;
}

export default function AdmissionFormPage() {
  const { academicYear, academicYears } = useApp();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<
    { id: string; name: string; sections: { id: string; name: string }[] }[]
  >([]);
  const [feeCategories, setFeeCategories] = useState<{ id: string; name: string }[]>([]);

  // Form State
  const [form, setForm] = useState({
    name: '',
    academicYearId: '',
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
    dateOfBirth: '',
    gender: 'MALE',
    bloodGroup: '',
    aadhaarNumber: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    classId: '',
    sectionId: '',
    rollNumber: '',
    admissionDate: new Date().toISOString().split('T')[0],
    emergencyContact: '',
    previousSchool: '',
    previousClass: '',
    tcNumber: '',
    remarks: '',
    photoPath: '',
    status: 'ACTIVE',
  });

  // Fee Form State
  const [feeForm, setFeeForm] = useState({
    feeCategoryId: '',
    totalAmount: '',
    paidAmount: '',
    paymentMethod: 'CASH',
    paymentDate: new Date().toISOString().split('T')[0],
    remarks: 'Admission fee payment',
  });

  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [showOtherNameModal, setShowOtherNameModal] = useState(false);
  const [pendingOtherName, setPendingOtherName] = useState('');
  const [activeDocType, setActiveDocType] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadClasses();
    loadFeeCategories();
    if (academicYear?.id) {
      setForm((prev) => ({ ...prev, academicYearId: academicYear.id }));
    }
  }, [academicYear]);

  const loadClasses = async () => {
    try {
      const data = await apiCall(() => window.api.classes.list());
      setClasses(data as typeof classes);
    } catch {
      // ignore
    }
  };

  const loadFeeCategories = async () => {
    try {
      const cats = await apiCall(() => window.api.fees.getCategories());
      setFeeCategories((cats as { id: string; name: string }[]) || []);
    } catch {
      // ignore
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showError('Photo must be less than 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((prev) => ({ ...prev, photoPath: reader.result as string }));
      success('Photo attached');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const triggerDocUpload = (type: string) => {
    if (type === 'OTHER') {
      setPendingOtherName('');
      setShowOtherNameModal(true);
    } else {
      setActiveDocType(type);
      docInputRef.current?.click();
    }
  };

  const confirmOtherDocName = () => {
    if (!pendingOtherName.trim()) {
      showError('Please enter a document name');
      return;
    }
    setShowOtherNameModal(false);
    setActiveDocType('OTHER');
    docInputRef.current?.click();
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeDocType) return;
    if (file.size > 5 * 1024 * 1024) {
      showError('Document must be less than 5MB');
      return;
    }

    const docTypeInfo = [...STUDENT_DOC_TYPES, ...PARENT_DOC_TYPES].find(
      (d) => d.value === activeDocType
    );
    const label =
      activeDocType === 'OTHER'
        ? pendingOtherName.trim() || 'Other Document'
        : docTypeInfo?.label || activeDocType;

    const reader = new FileReader();
    reader.onloadend = () => {
      const newDoc: DocItem = {
        id: `${Date.now()}-${Math.random()}`,
        name: file.name,
        type: activeDocType,
        filePath: reader.result as string,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        docLabel: label,
      };

      setDocuments((prev) => [
        ...prev.filter((d) => d.type !== activeDocType || activeDocType === 'OTHER'),
        newDoc,
      ]);
      success(`${label} attached`);
      setActiveDocType(null);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const removeDoc = (id: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      showError('Student name is required');
      return;
    }

    const aadhaarDigits = form.aadhaarNumber.replace(/\D/g, '');
    if (aadhaarDigits.length > 0 && aadhaarDigits.length !== 12) {
      showError('Aadhaar Number must be exactly 12 digits');
      return;
    }

    setLoading(true);
    try {
      const sanitizeStr = (val?: string) => (val && val.trim() ? val.trim() : '');

      const payload = {
        details: {
          fullName: form.name.trim(),
          dateOfBirth: form.dateOfBirth,
          gender: form.gender || 'MALE',
          bloodGroup: sanitizeStr(form.bloodGroup),
          aadhaarNumber: aadhaarDigits || '',
          previousSchool: sanitizeStr(form.previousSchool),
          photoPath: form.photoPath || '',
        },
        parent: {
          fatherName: sanitizeStr(form.fatherName),
          fatherMobile: sanitizeStr(form.fatherMobile),
          fatherOccupation: sanitizeStr(form.fatherOccupation),
          fatherEmail: sanitizeStr(form.fatherEmail),
          motherName: sanitizeStr(form.motherName),
          motherMobile: sanitizeStr(form.motherMobile),
          motherOccupation: sanitizeStr(form.motherOccupation),
          motherEmail: sanitizeStr(form.motherEmail),
          guardianName: sanitizeStr(form.guardianName),
          guardianMobile: sanitizeStr(form.guardianMobile),
          guardianEmail: sanitizeStr(form.guardianEmail),
          guardianRelation: sanitizeStr(form.guardianRelation),
          address: sanitizeStr(form.address),
          city: sanitizeStr(form.city),
          state: sanitizeStr(form.state),
          pincode: sanitizeStr(form.pincode),
        },
        academic: {
          academicYearId: form.academicYearId || academicYear?.id,
          classId: sanitizeStr(form.classId),
          sectionId: sanitizeStr(form.sectionId),
          rollNumber: sanitizeStr(form.rollNumber),
          admissionDate: form.admissionDate,
          previousClass: sanitizeStr(form.previousClass),
          tcNumber: sanitizeStr(form.tcNumber),
          admissionStatus: 'ENROLLED',
        },
        documents: documents.map((doc) => ({
          id: doc.id,
          name: doc.name,
          type: doc.type,
          filePath: doc.filePath,
          fileSize: doc.fileSize || 0,
          mimeType: doc.mimeType || 'application/octet-stream',
        })),
        fee: {
          feeCategoryId: feeForm.feeCategoryId || undefined,
          amount: Number(feeForm.totalAmount || feeForm.paidAmount || 0),
          discount: 0,
          paidAmount: Number(feeForm.paidAmount || 0),
          paymentMethod: feeForm.paymentMethod || 'CASH',
          paymentReference: sanitizeStr(feeForm.remarks),
        },
        files: documents,
        draft: false,
        remarks: sanitizeStr(form.remarks) || 'New Admission Application',
      };

      await apiCall(() => window.api.admissions.wizard(payload));

      if (Number(feeForm.paidAmount || 0) > 0) {
        success(`Admission completed & payment of ₹${Number(feeForm.paidAmount).toLocaleString()} recorded!`);
      } else {
        success('Admission completed successfully');
      }

      navigate('/admissions');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save admission');
    } finally {
      setLoading(false);
    }
  };

  const selectedClass = classes.find((c) => c.id === form.classId);
  const sectionOptions =
    selectedClass?.sections.map((s) => ({ value: s.id, label: s.name })) || [];
  const aadhaarDigitsOnly = form.aadhaarNumber.replace(/\D/g, '');

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/admissions')}
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <PageHeader
            title="Add New Admission"
            subtitle="Enter admission details, photo, documents, and initial fee"
          />
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* ── 1. Basic Information & Photo ───────────────────────────────── */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User className="w-4 h-4 text-primary-600" /> Basic Information & Photo
          </h3>

          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Photo Avatar & Controls */}
            <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 dark:bg-gray-800/40 rounded-2xl border border-gray-100 dark:border-gray-800 w-full md:w-56 flex-shrink-0 text-center">
              <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-primary-500/20 shadow-md bg-white dark:bg-gray-700 flex items-center justify-center">
                {form.photoPath ? (
                  <img
                    src={form.photoPath}
                    alt="Student Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <p className="text-xs text-gray-500">Student Profile Photo</p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => photoInputRef.current?.click()}
                >
                  <Upload className="w-3 h-3 mr-1" />
                  {form.photoPath ? 'Change' : 'Upload'}
                </Button>
                {form.photoPath && (
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => setForm((prev) => ({ ...prev, photoPath: '' }))}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            </div>

            {/* Core Details */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Input
                  label="Full Name *"
                  required
                  placeholder="Enter student's full name"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <Input
                label="Date of Birth *"
                type="date"
                required
                value={form.dateOfBirth}
                onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
              />

              <Select
                label="Gender *"
                options={GENDER_OPTIONS}
                value={form.gender}
                onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
              />

              <Select
                label="Blood Group"
                options={BLOOD_GROUPS.map((b) => ({ value: b, label: b }))}
                placeholder="Select blood group"
                value={form.bloodGroup}
                onChange={(e) => setForm((prev) => ({ ...prev, bloodGroup: e.target.value }))}
              />

              {/* Aadhaar Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Aadhaar Number <span className="text-gray-400 font-normal">(12 digits)</span>
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={14}
                  placeholder="XXXX XXXX XXXX"
                  value={form.aadhaarNumber}
                  onChange={(e) => {
                    const formatted = formatAadhaar(e.target.value);
                    setForm((prev) => ({ ...prev, aadhaarNumber: formatted }));
                  }}
                  className={`input w-full font-mono tracking-widest ${
                    aadhaarDigitsOnly.length > 0 && aadhaarDigitsOnly.length !== 12
                      ? 'border-red-400 focus:ring-red-400'
                      : ''
                  }`}
                />
                {aadhaarDigitsOnly.length > 0 && aadhaarDigitsOnly.length !== 12 && (
                  <p className="text-xs text-red-500 mt-1">
                    Aadhaar must be exactly 12 digits ({aadhaarDigitsOnly.length}/12)
                  </p>
                )}
                {aadhaarDigitsOnly.length === 12 && (
                  <p className="text-xs text-green-600 mt-1">✓ Valid Aadhaar number</p>
                )}
              </div>

              <div className="md:col-span-2">
                <Input
                  label="Previous School"
                  placeholder="Name of previous school (if applicable)"
                  value={form.previousSchool}
                  onChange={(e) => setForm((prev) => ({ ...prev, previousSchool: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Academic & Class Information ─────────────────────────────── */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Academic & Class Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select
              label="Academic Year"
              options={academicYears.map((y) => ({
                value: y.id,
                label: y.isCurrent ? `${y.name} (Current)` : y.name,
              }))}
              placeholder="Select academic year"
              value={form.academicYearId}
              onChange={(e) => setForm((prev) => ({ ...prev, academicYearId: e.target.value }))}
            />
            <Select
              label="Class"
              options={classes.map((c) => ({
                value: c.id,
                label: `Class ${c.name}`,
              }))}
              placeholder="Select class"
              value={form.classId}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, classId: e.target.value, sectionId: '' }))
              }
            />
            <Select
              label="Section"
              options={sectionOptions}
              placeholder={
                !form.classId
                  ? '← Select class first'
                  : sectionOptions.length === 0
                  ? 'No sections'
                  : 'Select section'
              }
              value={form.sectionId}
              onChange={(e) => setForm((prev) => ({ ...prev, sectionId: e.target.value }))}
            />
            <Input
              label="Roll Number"
              value={form.rollNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, rollNumber: e.target.value }))}
            />
            <Input
              label="Admission Date"
              type="date"
              value={form.admissionDate}
              onChange={(e) => setForm((prev) => ({ ...prev, admissionDate: e.target.value }))}
            />
            <Select
              label="Student Status"
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
                { value: 'TRANSFERRED', label: 'Transferred' },
                { value: 'GRADUATED', label: 'Graduated' },
              ]}
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            />
          </div>
        </div>

        {/* ── 3. Parent & Guardian Details ─────────────────────────────────── */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Parent & Guardian Details
          </h3>

          <div className="space-y-6">
            {/* Father */}
            <div>
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">
                Father's Information
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  label="Father's Name"
                  value={form.fatherName}
                  onChange={(e) => setForm((prev) => ({ ...prev, fatherName: e.target.value }))}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Father's Mobile
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    value={form.fatherMobile}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setForm((prev) => ({ ...prev, fatherMobile: v }));
                    }}
                    className="input w-full"
                  />
                  {form.fatherMobile.length > 0 && form.fatherMobile.length < 10 && (
                    <p className="text-xs text-orange-500 mt-1">
                      {form.fatherMobile.length}/10 digits
                    </p>
                  )}
                </div>
                <Input
                  label="Father's Occupation"
                  value={form.fatherOccupation}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, fatherOccupation: e.target.value }))
                  }
                />
                <Input
                  label="Father's Email"
                  type="email"
                  value={form.fatherEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, fatherEmail: e.target.value }))}
                />
              </div>
            </div>

            {/* Mother */}
            <div>
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider mb-3">
                Mother's Information
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  label="Mother's Name"
                  value={form.motherName}
                  onChange={(e) => setForm((prev) => ({ ...prev, motherName: e.target.value }))}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Mother's Mobile
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="10-digit number"
                    value={form.motherMobile}
                    onChange={(e) => {
                      const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setForm((prev) => ({ ...prev, motherMobile: v }));
                    }}
                    className="input w-full"
                  />
                  {form.motherMobile.length > 0 && form.motherMobile.length < 10 && (
                    <p className="text-xs text-orange-500 mt-1">
                      {form.motherMobile.length}/10 digits
                    </p>
                  )}
                </div>
                <Input
                  label="Mother's Occupation"
                  value={form.motherOccupation}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, motherOccupation: e.target.value }))
                  }
                />
                <Input
                  label="Mother's Email"
                  type="email"
                  value={form.motherEmail}
                  onChange={(e) => setForm((prev) => ({ ...prev, motherEmail: e.target.value }))}
                />
              </div>
            </div>

            {/* Guardian */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Guardian's Information (If Applicable)
              </p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Input
                  label="Guardian's Name"
                  value={form.guardianName}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, guardianName: e.target.value }))
                  }
                />
                <Input
                  label="Guardian's Mobile"
                  value={form.guardianMobile}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, guardianMobile: e.target.value }))
                  }
                />
                <Input
                  label="Relation with Student"
                  placeholder="e.g. Uncle, Grandfather"
                  value={form.guardianRelation}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, guardianRelation: e.target.value }))
                  }
                />
                <Input
                  label="Guardian's Email"
                  type="email"
                  value={form.guardianEmail}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, guardianEmail: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 4. Contact & Address Details ─────────────────────────────────── */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
            Contact & Address Details
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-4">
              <Input
                label="Full Residential Address"
                placeholder="Street name, landmark, house/flat number"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <Input
              label="City"
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            />
            <Input
              label="State"
              value={form.state}
              onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
            />
            <Input
              label="PIN Code"
              maxLength={6}
              value={form.pincode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setForm((prev) => ({ ...prev, pincode: v }));
              }}
            />
          </div>
        </div>

        {/* ── 5. Student Documents & Attachments ───────────────────────────── */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Student & Parent Documents
              </h3>
              <p className="text-xs text-gray-500">
                Attach document copies (PDF, JPG, PNG, DOC - Max 5MB each)
              </p>
            </div>
            {documents.length > 0 && (
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">
                {documents.length} Attached
              </span>
            )}
          </div>

          {/* Attached Documents List */}
          {documents.length > 0 && (
            <div className="mb-6 space-y-2">
              <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                Attached Files
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60"
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden">
                      <FileText className="w-5 h-5 text-primary-600 flex-shrink-0" />
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {doc.docLabel || doc.name}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">{doc.name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(doc)}
                        className="p-1 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
                        title="Preview document"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeDoc(doc.id)}
                        className="p-1 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Delete document"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document Upload Sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Student Documents */}
            <div className="rounded-xl border border-primary-100 dark:border-primary-900/40 bg-primary-50/30 dark:bg-primary-900/10 p-4">
              <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wider mb-2">
                + Add Student Document
              </p>
              <div className="space-y-1.5">
                {STUDENT_DOC_TYPES.map((t) => {
                  const alreadyUploaded = documents.some((d) => d.type === t.value);
                  return (
                    <div
                      key={t.value}
                      className="flex items-center justify-between py-1.5 border-b border-primary-100/50 dark:border-primary-900/20 last:border-0"
                    >
                      <span className="text-xs text-gray-700 dark:text-gray-300">
                        {t.label}
                      </span>
                      {alreadyUploaded ? (
                        <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Attached
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => triggerDocUpload(t.value)}
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

            {/* Parent Documents */}
            <div className="rounded-xl border border-purple-100 dark:border-purple-900/40 bg-purple-50/30 dark:bg-purple-900/10 p-4">
              <p className="text-xs font-semibold text-purple-700 dark:text-purple-400 uppercase tracking-wider mb-2">
                + Add Parent Document
              </p>
              <div className="space-y-1.5">
                {PARENT_DOC_TYPES.map((t) => {
                  const alreadyUploaded = documents.some((d) => d.type === t.value);
                  return (
                    <div
                      key={t.value}
                      className="flex items-center justify-between py-1.5 border-b border-purple-100/50 dark:border-purple-900/20 last:border-0"
                    >
                      <span className="text-xs text-gray-700 dark:text-gray-300">
                        {t.label}
                      </span>
                      {alreadyUploaded ? (
                        <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Attached
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => triggerDocUpload(t.value)}
                          className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 font-medium"
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

          {/* Other Document */}
          <div className="mt-4 flex items-center justify-between p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Other Custom Document (Certificate, Medical Report, etc.)
            </span>
            <button
              type="button"
              onClick={() => triggerDocUpload('OTHER')}
              className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Upload Other
            </button>
          </div>

          {/* Other Document Name Modal */}
          {showOtherNameModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 w-full max-w-sm mx-4 border border-gray-200 dark:border-gray-700">
                <h4 className="text-base font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-600" /> Document Name
                </h4>
                <p className="text-xs text-gray-500 mb-4">
                  Enter a name for this custom document (e.g. Migration Certificate)
                </p>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. Migration Certificate"
                  value={pendingOtherName}
                  onChange={(e) => setPendingOtherName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmOtherDocName();
                    if (e.key === 'Escape') setShowOtherNameModal(false);
                  }}
                  className="input w-full mb-4"
                />
                <div className="flex gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowOtherNameModal(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={confirmOtherDocName}
                    disabled={!pendingOtherName.trim()}
                    className="px-4 py-2 text-sm font-medium bg-primary-600 text-white rounded-xl hover:bg-primary-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Continue & Choose File
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── 6. Admission Fee & Payment (Last Section) ────────────────────── */}
        <div className="card p-6 border-2 border-emerald-100 dark:border-emerald-950/40 bg-gradient-to-br from-emerald-50/20 via-transparent to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Admission Fee & Payment
              </h3>
              <p className="text-xs text-gray-500">
                Collect fee or record initial payment during admission (leave blank if no payment received now)
              </p>
            </div>
          </div>

          <div className="space-y-4 pt-3 border-t border-emerald-100 dark:border-emerald-950/40">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              <Select
                label="Fee Category"
                options={feeCategories.map((c) => ({ value: c.id, label: c.name }))}
                placeholder="Select category (e.g. Admission Fee)"
                value={feeForm.feeCategoryId}
                onChange={(e) =>
                  setFeeForm((prev) => ({ ...prev, feeCategoryId: e.target.value }))
                }
              />
              <Input
                label="Total Applicable Fee (₹)"
                type="number"
                min="0"
                placeholder="e.g. 5000"
                value={feeForm.totalAmount}
                onChange={(e) =>
                  setFeeForm((prev) => ({ ...prev, totalAmount: e.target.value }))
                }
              />
              <Input
                label="Amount Paid Now (₹)"
                type="number"
                min="0"
                placeholder="e.g. 5000"
                value={feeForm.paidAmount}
                onChange={(e) =>
                  setFeeForm((prev) => ({ ...prev, paidAmount: e.target.value }))
                }
              />
              <Select
                label="Payment Method"
                options={PAYMENT_METHODS}
                value={feeForm.paymentMethod}
                onChange={(e) =>
                  setFeeForm((prev) => ({ ...prev, paymentMethod: e.target.value }))
                }
              />
              <Input
                label="Payment Date"
                type="date"
                value={feeForm.paymentDate}
                onChange={(e) =>
                  setFeeForm((prev) => ({ ...prev, paymentDate: e.target.value }))
                }
              />
              <Input
                label="Payment Note / Receipt Remarks"
                placeholder="e.g. Admission fee receipt"
                value={feeForm.remarks}
                onChange={(e) =>
                  setFeeForm((prev) => ({ ...prev, remarks: e.target.value }))
                }
              />
            </div>

            {/* Live fee summary badge */}
            {(Number(feeForm.paidAmount || 0) > 0 || Number(feeForm.totalAmount || 0) > 0) && (
              <div className="rounded-xl bg-white dark:bg-gray-800/80 p-4 border border-emerald-200/70 dark:border-emerald-900/50 flex flex-wrap items-center justify-between gap-4 text-sm shadow-sm">
                <div>
                  <span className="text-xs text-gray-500 block">Total Fee:</span>
                  <strong className="text-base text-gray-900 dark:text-white">
                    ₹{Number(feeForm.totalAmount || feeForm.paidAmount || 0).toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Paid Now:</span>
                  <strong className="text-base text-emerald-600 dark:text-emerald-400">
                    ₹{Number(feeForm.paidAmount || 0).toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span className="text-xs text-gray-500 block">Remaining Due:</span>
                  <strong
                    className={`text-base ${
                      Number(feeForm.totalAmount || 0) - Number(feeForm.paidAmount || 0) > 0
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    ₹{Math.max(
                      0,
                      Number(feeForm.totalAmount || 0) - Number(feeForm.paidAmount || 0)
                    ).toLocaleString()}
                  </strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Action Buttons ─────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate('/admissions')}
          >
            Cancel
          </Button>
          <Button type="submit" loading={loading} className="px-6">
            <Save className="w-4 h-4 mr-2" />
            Complete Admission
          </Button>
        </div>
      </form>

      {/* Hidden File Inputs */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoChange}
      />
      <input
        ref={docInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
        className="hidden"
        onChange={handleDocChange}
      />

      {/* In-App Document Viewer Modal */}
      <Modal
        isOpen={!!previewDoc}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.name || 'Document Preview'}
        size="xl"
      >
        {previewDoc && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-gray-500 pb-2 border-b border-gray-100 dark:border-gray-800">
              <span>
                Document Type:{' '}
                <strong className="text-gray-700 dark:text-gray-300 font-semibold">
                  {previewDoc.docLabel || previewDoc.type}
                </strong>
              </span>
              {previewDoc.filePath && (
                <a
                  href={previewDoc.filePath}
                  download={previewDoc.name}
                  className="text-primary-600 hover:underline font-medium flex items-center gap-1 text-xs"
                >
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
              )}
            </div>

            <div className="flex items-center justify-center min-h-[350px] max-h-[75vh] bg-gray-50 dark:bg-gray-800/40 rounded-xl p-2 overflow-auto border border-gray-100 dark:border-gray-800">
              {previewDoc.filePath &&
              (previewDoc.filePath.startsWith('data:image/') ||
                /\.(png|jpe?g|webp|gif|svg)$/i.test(previewDoc.name)) ? (
                <img
                  src={previewDoc.filePath}
                  alt={previewDoc.name}
                  className="max-h-[70vh] max-w-full object-contain rounded-lg shadow-sm"
                />
              ) : previewDoc.filePath &&
                (previewDoc.filePath.startsWith('data:application/pdf') ||
                  previewDoc.filePath.startsWith('data:') ||
                  /\.pdf$/i.test(previewDoc.name)) ? (
                <embed
                  src={previewDoc.filePath}
                  type="application/pdf"
                  className="w-full h-[70vh] rounded-lg border border-gray-200 dark:border-gray-700 bg-white"
                />
              ) : (
                <div className="text-center p-8">
                  <FileText className="w-16 h-16 text-primary-500 mx-auto mb-3" />
                  <p className="font-semibold text-base text-gray-800 dark:text-gray-200">
                    {previewDoc.name}
                  </p>
                  {previewDoc.filePath && (
                    <a
                      href={previewDoc.filePath}
                      download={previewDoc.name}
                      className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
                    >
                      <Download className="w-4 h-4" /> Download Document
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
