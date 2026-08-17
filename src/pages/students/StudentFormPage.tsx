import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ArrowLeft } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useToast } from '../../context/ToastContext';
import { PageHeader, LoadingSpinner } from '../../components/ui/Common';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { GENDER_OPTIONS, BLOOD_GROUPS, apiCall } from '../../utils/helpers';

const studentSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  fatherName: z.string().optional(),
  motherName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']).optional(),
  bloodGroup: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  classId: z.string().optional(),
  sectionId: z.string().optional(),
  rollNumber: z.string().optional(),
  admissionDate: z.string().optional(),
  emergencyContact: z.string().optional(),
  previousSchool: z.string().optional(),
  remarks: z.string().optional(),
});

type StudentForm = z.infer<typeof studentSchema>;

export default function StudentFormPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const { academicYear } = useApp();
  const { success, error: showError } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(isEdit);
  const [classes, setClasses] = useState<{ id: string; name: string; sections: { id: string; name: string }[] }[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<StudentForm>({
    resolver: zodResolver(studentSchema),
  });

  const selectedClassId = watch('classId');

  useEffect(() => { loadClasses(); if (isEdit) loadStudent(); }, []);

  const loadClasses = async () => {
    const data = await apiCall(() => window.api.classes.list());
    setClasses(data as typeof classes);
  };

  const loadStudent = async () => {
    try {
      const student = await apiCall(() => window.api.students.get(id!)) as Record<string, unknown>;
      Object.entries(student).forEach(([key, value]) => {
        if (value && typeof value === 'string') {
          if (key.includes('Date') || key === 'dateOfBirth') {
            setValue(key as keyof StudentForm, (value as string).split('T')[0]);
          } else if (key !== 'id' && key !== 'studentId' && key !== 'admissionNumber') {
            setValue(key as keyof StudentForm, value as string);
          }
        }
      });
    } catch (err) {
      showError('Failed to load student');
    } finally {
      setPageLoading(false);
    }
  };

  const onSubmit = async (data: StudentForm) => {
    setLoading(true);
    try {
      const payload = {
        ...data,
        academicYearId: academicYear?.id,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : undefined,
        admissionDate: data.admissionDate ? new Date(data.admissionDate) : undefined,
      };

      if (isEdit) {
        await apiCall(() => window.api.students.update(id!, payload));
        success('Student updated successfully');
      } else {
        await apiCall(() => window.api.students.create(payload));
        success('Student created successfully');
      }
      navigate('/students');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Failed to save student');
    } finally {
      setLoading(false);
    }
  };

  const selectedClass = classes.find(c => c.id === selectedClassId);
  const sectionOptions = selectedClass?.sections.map(s => ({ value: s.id, label: s.name })) || [];

  if (pageLoading) return <LoadingSpinner />;

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => navigate('/students')}><ArrowLeft className="w-4 h-4" /></Button>
        <PageHeader title={isEdit ? 'Edit Student' : 'Add Student'} />
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="card p-6 max-w-4xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Student Name *" error={errors.name?.message} {...register('name')} />
          <Input label="Father's Name" {...register('fatherName')} />
          <Input label="Mother's Name" {...register('motherName')} />
          <Input label="Date of Birth" type="date" {...register('dateOfBirth')} />
          <Select label="Gender" options={GENDER_OPTIONS} placeholder="Select gender" {...register('gender')} />
          <Select label="Blood Group" options={BLOOD_GROUPS.map(b => ({ value: b, label: b }))} placeholder="Select" {...register('bloodGroup')} />
          <Input label="Phone" {...register('phone')} />
          <Input label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input label="Address" className="md:col-span-2" {...register('address')} />
          <Input label="City" {...register('city')} />
          <Input label="State" {...register('state')} />
          <Input label="Pincode" {...register('pincode')} />
          <Select label="Class" options={classes.map(c => ({ value: c.id, label: `Class ${c.name}` }))} placeholder="Select class" {...register('classId')} />
          <Select label="Section" options={sectionOptions} placeholder="Select section" {...register('sectionId')} />
          <Input label="Roll Number" {...register('rollNumber')} />
          <Input label="Admission Date" type="date" {...register('admissionDate')} />
          <Input label="Emergency Contact" {...register('emergencyContact')} />
          <Input label="Previous School" {...register('previousSchool')} />
          <Input label="Remarks" className="md:col-span-2" {...register('remarks')} />
        </div>

        <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <Button variant="secondary" type="button" onClick={() => navigate('/students')}>Cancel</Button>
          <Button type="submit" loading={loading}>{isEdit ? 'Update Student' : 'Save Student'}</Button>
        </div>
      </form>
    </div>
  );
}
