import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  Upload,
  Trash2,
  Briefcase,
  Phone,
  MapPin,
  Save,
  FileText,
  Eye,
  Download,
  Plus,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Modal } from '../../components/ui/Modal';
import { GENDER_OPTIONS, BLOOD_GROUPS, apiCall, getLocalFileUrl } from '../../utils/helpers';

const TEACHER_SUBJECTS = [
  'Mathematics',
  'Science',
  'English',
  'Hindi',
  'Social Science',
  'Physics',
  'Chemistry',
  'Biology',
  'Computer Science',
  'Sanskrit',
  'Physical Education',
  'Art & Craft',
  'Music',
  'General Knowledge',
  'Other',
];

const TEACHER_DOC_TYPES = [
  { value: 'TEACHER_AADHAAR', label: "Teacher's Aadhaar Card" },
  { value: 'TEACHER_PAN', label: "Teacher's PAN Card" },
  { value: 'DEGREE_CERTIFICATE', label: 'Highest Degree / B.Ed Certificate' },
  { value: 'RESUME_CV', label: 'Resume / Curriculum Vitae (CV)' },
  { value: 'EXPERIENCE_LETTER', label: 'Previous Experience / Relieving Letter' },
  { value: 'JOINING_LETTER', label: 'Appointment / Joining Letter' },
  { value: 'PASSPORT_PHOTO', label: 'Passport Size Photo' },
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

export default function TeacherFormPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const { success, error: showError } = useToast();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEdit);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: '',
    gender: 'MALE',
    dateOfBirth: '',
    bloodGroup: '',
    aadhaarNumber: '',
    panNumber: '',
    phone: '',
    email: '',
    qualification: '',
    subject: '',
    experience: '',
    joiningDate: new Date().toISOString().split('T')[0],
    salary: '',
    status: 'ACTIVE',
    maritalStatus: 'SINGLE',
    fatherName: '',
    motherName: '',
    emergencyContact: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    photoPath: '',
  });

  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [showOtherNameModal, setShowOtherNameModal] = useState(false);
  const [pendingOtherName, setPendingOtherName] = useState('');
  const [activeDocType, setActiveDocType] = useState<string | null>(null);

  useEffect(() => {
    if (isEdit && id) {
      loadTeacher();
    }
  }, [id, isEdit]);

  const loadTeacher = async () => {
    setPageLoading(true);
    try {
      const data = (await apiCall(() => window.api.teachers.get(id!))) as Record<string, any>;
      if (data) {
        setForm({
          name: data.name || '',
          gender: data.gender || 'MALE',
          dateOfBirth: data.dateOfBirth
            ? new Date(data.dateOfBirth).toISOString().split('T')[0]
            : '',
          bloodGroup: data.bloodGroup || '',
          aadhaarNumber: data.aadhaarNumber ? formatAadhaar(data.aadhaarNumber) : '',
          panNumber: data.panNumber || '',
          phone: data.phone || '',
          email: data.email || '',
          qualification: data.qualification || '',
          subject: data.subject || '',
          experience: data.experience || '',
          joiningDate: data.joiningDate
            ? new Date(data.joiningDate).toISOString().split('T')[0]
            : new Date().toISOString().split('T')[0],
          salary: data.salaryPaise ? String(Number(data.salaryPaise) / 100) : '',
          status: data.status || 'ACTIVE',
          maritalStatus: data.maritalStatus || 'SINGLE',
          fatherName: data.fatherName || '',
          motherName: data.motherName || '',
          emergencyContact: data.emergencyContact || '',
          address: data.address || '',
          city: data.city || '',
          state: data.state || '',
          pincode: data.pincode || '',
          photoPath: data.photoPath || '',
        });

        // Load existing teacher documents
        if (Array.isArray(data.documents) && data.documents.length > 0) {
          const loadedDocs: DocItem[] = data.documents.map((d: any) => {
            const docInfo = TEACHER_DOC_TYPES.find((t) => t.value === d.type);
            return {
              id: d.id || `${Date.now()}-${Math.random()}`,
              name: d.name,
              type: d.type,
              filePath: d.filePath,
              fileSize: d.fileSize || 0,
              mimeType: d.mimeType || 'application/octet-stream',
              docLabel: docInfo?.label || d.name || 'Document',
            };
          });
          setDocuments(loadedDocs);
        }
      }
    } catch (err) {
      showError('Failed to load teacher details');
      navigate('/teachers');
    } finally {
      setPageLoading(false);
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

    const docTypeInfo = TEACHER_DOC_TYPES.find((d) => d.value === activeDocType);
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
      showError('Teacher full name is required');
      return;
    }

    const aadhaarDigits = form.aadhaarNumber.replace(/\D/g, '');
    if (aadhaarDigits.length > 0 && aadhaarDigits.length !== 12) {
      showError('Aadhaar Number must be exactly 12 digits');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name: form.name.trim(),
        gender: form.gender || 'MALE',
        dateOfBirth: form.dateOfBirth ? form.dateOfBirth : null,
        bloodGroup: form.bloodGroup || null,
        aadhaarNumber: aadhaarDigits || null,
        panNumber: form.panNumber.trim().toUpperCase() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        qualification: form.qualification.trim() || null,
        subject: form.subject.trim() || null,
        experience: form.experience.trim() || null,
        joiningDate: form.joiningDate ? form.joiningDate : null,
        salaryPaise: form.salary ? Math.round(Number(form.salary) * 100) : 0,
        status: form.status || 'ACTIVE',
        maritalStatus: form.maritalStatus || 'SINGLE',
        fatherName: form.fatherName.trim() || null,
        motherName: form.motherName.trim() || null,
        emergencyContact: form.emergencyContact.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        state: form.state.trim() || null,
        pincode: form.pincode.trim() || null,
        photoPath: form.photoPath || null,
        documents: documents.map((doc) => ({
          name: doc.name,
          type: doc.type,
          filePath: doc.filePath,
          fileSize: doc.fileSize || 0,
          mimeType: doc.mimeType || 'application/octet-stream',
        })),
      };

      if (isEdit && id) {
        await apiCall(() => window.api.teachers.update(id, payload));
        success('Teacher updated successfully');
      } else {
        await apiCall(() => window.api.teachers.create(payload));
        success('Teacher added successfully');
      }

      navigate('/teachers');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save teacher');
    } finally {
      setLoading(false);
    }
  };

  const aadhaarDigitsOnly = form.aadhaarNumber.replace(/\D/g, '');

  if (pageLoading) return <LoadingSpinner message="Loading teacher details..." />;

  return (
    <div className="max-w-5xl mx-auto pb-12">
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => navigate('/teachers')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <PageHeader
            title={isEdit ? `Edit Teacher: ${form.name}` : 'Add New Teacher'}
            subtitle="Update teacher personal details, qualifications, documents, and contact"
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
                    src={getLocalFileUrl(form.photoPath)}
                    alt="Teacher Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <p className="text-xs text-gray-500">Teacher Profile Photo</p>
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
                  placeholder="e.g. Amit Kumar Sharma"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <Select
                label="Gender *"
                options={GENDER_OPTIONS}
                value={form.gender}
                onChange={(e) => setForm((prev) => ({ ...prev, gender: e.target.value }))}
              />

              <Input
                label="Date of Birth"
                type="date"
                value={form.dateOfBirth}
                onChange={(e) => setForm((prev) => ({ ...prev, dateOfBirth: e.target.value }))}
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
                  <p className="text-xs text-green-600 mt-1">✓ Valid Aadhaar</p>
                )}
              </div>

              {/* PAN Number */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  PAN Card Number
                </label>
                <input
                  type="text"
                  maxLength={10}
                  placeholder="ABCDE1234F"
                  value={form.panNumber}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, panNumber: e.target.value.toUpperCase() }))
                  }
                  className="input w-full font-mono uppercase tracking-wider"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Mobile Phone Number
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="10-digit mobile number"
                  value={form.phone}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                    setForm((prev) => ({ ...prev, phone: v }));
                  }}
                  className="input w-full"
                />
              </div>

              <div className="md:col-span-2">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="teacher@school.com"
                  value={form.email}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── 2. Professional & Academic Details ─────────────────────────── */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-primary-600" /> Professional & Employment Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Primary Subject / Department
              </label>
              <input
                type="text"
                list="subject-suggestions"
                placeholder="e.g. Mathematics, Science"
                value={form.subject}
                onChange={(e) => setForm((prev) => ({ ...prev, subject: e.target.value }))}
                className="input w-full"
              />
              <datalist id="subject-suggestions">
                {TEACHER_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub} />
                ))}
              </datalist>
            </div>

            <Input
              label="Highest Qualification"
              placeholder="e.g. M.Sc, B.Ed, M.A, Ph.D"
              value={form.qualification}
              onChange={(e) => setForm((prev) => ({ ...prev, qualification: e.target.value }))}
            />

            <Input
              label="Teaching Experience"
              placeholder="e.g. 5 Years in Senior Secondary"
              value={form.experience}
              onChange={(e) => setForm((prev) => ({ ...prev, experience: e.target.value }))}
            />

            <Input
              label="Joining Date"
              type="date"
              value={form.joiningDate}
              onChange={(e) => setForm((prev) => ({ ...prev, joiningDate: e.target.value }))}
            />

            <Input
              label="Monthly Salary (₹)"
              type="number"
              min="0"
              placeholder="e.g. 35000"
              value={form.salary}
              onChange={(e) => setForm((prev) => ({ ...prev, salary: e.target.value }))}
            />

            <Select
              label="Teacher Status"
              options={[
                { value: 'ACTIVE', label: 'Active' },
                { value: 'INACTIVE', label: 'Inactive' },
                { value: 'ON_LEAVE', label: 'On Leave' },
              ]}
              value={form.status}
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
            />
          </div>
        </div>

        {/* ── 3. Family & Emergency Details ──────────────────────────────── */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <Phone className="w-4 h-4 text-primary-600" /> Family & Emergency Contact
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Input
              label="Father's / Spouse Name"
              placeholder="Enter name"
              value={form.fatherName}
              onChange={(e) => setForm((prev) => ({ ...prev, fatherName: e.target.value }))}
            />
            <Input
              label="Mother's Name"
              placeholder="Enter name"
              value={form.motherName}
              onChange={(e) => setForm((prev) => ({ ...prev, motherName: e.target.value }))}
            />
            <Select
              label="Marital Status"
              options={[
                { value: 'SINGLE', label: 'Single' },
                { value: 'MARRIED', label: 'Married' },
                { value: 'OTHER', label: 'Other' },
              ]}
              value={form.maritalStatus}
              onChange={(e) => setForm((prev) => ({ ...prev, maritalStatus: e.target.value }))}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Emergency Contact Number
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                placeholder="10-digit number"
                value={form.emergencyContact}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, '').slice(0, 10);
                  setForm((prev) => ({ ...prev, emergencyContact: v }));
                }}
                className="input w-full"
              />
            </div>
          </div>
        </div>

        {/* ── 4. Address & Location Details ──────────────────────────────── */}
        <div className="card p-6">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-primary-600" /> Residential Address
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-4">
              <Input
                label="Full Address"
                placeholder="House / Flat No, Street, Landmark"
                value={form.address}
                onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
              />
            </div>
            <Input
              label="City"
              placeholder="e.g. Patna, Varanasi"
              value={form.city}
              onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
            />
            <Input
              label="State"
              placeholder="e.g. Bihar, Uttar Pradesh"
              value={form.state}
              onChange={(e) => setForm((prev) => ({ ...prev, state: e.target.value }))}
            />
            <Input
              label="PIN Code"
              maxLength={6}
              placeholder="6-digit PIN"
              value={form.pincode}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, '').slice(0, 6);
                setForm((prev) => ({ ...prev, pincode: v }));
              }}
            />
          </div>
        </div>

        {/* ── 5. Teacher Documents & Attachments ─────────────────────────── */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                Teacher Documents & Attachments
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

          {/* Standard Teacher Documents Upload Grid */}
          <div className="rounded-xl border border-primary-100 dark:border-primary-900/40 bg-primary-50/30 dark:bg-primary-900/10 p-4">
            <p className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wider mb-2">
              + Upload Required Documents
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {TEACHER_DOC_TYPES.map((t) => {
                const alreadyUploaded = documents.some((d) => d.type === t.value);
                return (
                  <div
                    key={t.value}
                    className="flex items-center justify-between py-2 px-3 rounded-lg bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700"
                  >
                    <span className="text-xs text-gray-700 dark:text-gray-300 font-medium">
                      {t.label}
                    </span>
                    {alreadyUploaded ? (
                      <span className="text-[11px] text-green-600 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Attached
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => triggerDocUpload(t.value)}
                        className="flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded-md hover:bg-primary-50 dark:hover:bg-primary-950/40"
                      >
                        <Upload className="w-3 h-3" /> Upload
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Other Custom Document */}
          <div className="mt-4 flex items-center justify-between p-3 rounded-xl border border-dashed border-gray-300 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/20">
            <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
              Other Custom Document (e.g. Award Certificate, Publication, Reference)
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
                  Enter a title for this custom document (e.g. National Award Certificate)
                </p>
                <input
                  type="text"
                  autoFocus
                  placeholder="e.g. National Award Certificate"
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

        {/* ── Action Buttons ─────────────────────────────────────────────── */}
        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <Button variant="secondary" type="button" onClick={() => navigate('/teachers')}>
            Cancel
          </Button>
          <Button type="submit" loading={loading} className="px-6">
            <Save className="w-4 h-4 mr-2" />
            {isEdit ? 'Update Teacher Details' : 'Save & Add Teacher'}
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
