import { siteData } from '../siteData';
import { assertSupabaseConfigured, supabase } from './supabaseClient';

export interface ParentRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  whatsappNumber: string | null;
  studentId: string;
  authUserId: string | null;
}

export interface StudentRecord {
  id: string;
  name: string;
  standard: string;
  joiningDate: string;
  status: 'active' | 'left';
  createdAt?: string;
}

export interface StudentWithParent extends StudentRecord {
  parent: ParentRecord | null;
}

export interface TestRecord {
  id: string;
  title: string;
  subject: string;
  testDate: string;
  totalMarks: number;
  fileName: string | null;
  fileType: string | null;
  filePath: string | null;
  marksCount: number;
}

export interface MarkRecord {
  id: string;
  testId: string;
  studentId: string;
  marksObtained: number;
  remark: string | null;
}

export interface StudentMarkWithTest {
  markId: string;
  testId: string;
  studentId: string;
  marksObtained: number;
  remark: string | null;
  title: string;
  subject: string;
  testDate: string;
  totalMarks: number;
  fileName: string | null;
  fileType: string | null;
  filePath: string | null;
  percentage: number;
}

export interface OverviewData {
  stats: {
    activeStudents: number;
    testsThisMonth: number;
    totalTests: number;
  };
  recentMarks: Array<{
    id: string;
    marksObtained: number;
    remark: string | null;
    studentName: string;
    testTitle: string;
    subject: string;
    testDate: string;
    totalMarks: number;
    percentage: number;
  }>;
}

const BUCKET_NAME = 'test-papers';
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

function friendlyError(err: unknown, fallback: string): Error {
  if (err && typeof err === 'object') {
    const e = err as { code?: string; message?: string };
    if (e.code === '23505') {
      return new Error('This email is already registered');
    }
    if (e.code === '42501') {
      return new Error('You do not have permission to perform this action.');
    }
    if (e.message && /jwt|expired|not authenticated/i.test(e.message)) {
      return new Error('Your session expired. Please sign in again.');
    }
  }
  return new Error(fallback);
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/^_+|_+$/g, '') || 'paper';
}

function validatePaperFile(file: File): void {
  const lower = file.name.toLowerCase();
  const validExt =
    lower.endsWith('.pdf') ||
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.webp');
  if (!ALLOWED_MIME_TYPES.has(file.type) && !validExt) {
    throw new Error('Please upload a PDF, JPG, PNG, or WEBP file.');
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error('File must be 10 MB or smaller.');
  }
}

async function compressImageIfNeeded(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
    return file;
  }

  return new Promise<File>((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const maxDim = 1800;
      let { width, height } = img;
      if (width <= maxDim && height <= maxDim && file.size <= 1.2 * 1024 * 1024) {
        resolve(file);
        return;
      }

      if (width > maxDim || height > maxDim) {
        const ratio = Math.min(maxDim / width, maxDim / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(file);
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);
      const outputType = file.type === 'image/png' ? 'image/jpeg' : file.type;
      canvas.toBlob(
        (blob) => {
          if (!blob || blob.size >= file.size) {
            resolve(file);
            return;
          }
          const ext = outputType === 'image/webp' ? 'webp' : 'jpg';
          const baseName = file.name.replace(/\.[^.]+$/, '');
          resolve(new File([blob], `${baseName}.${ext}`, { type: outputType }));
        },
        outputType,
        0.82,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file);
    };

    img.src = objectUrl;
  });
}

function mapParentRow(row: Record<string, unknown>): ParentRecord {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    email: String(row.email || ''),
    phone: String(row.phone || ''),
    whatsappNumber: row.whatsapp_number ? String(row.whatsapp_number) : null,
    studentId: String(row.student_id || ''),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
  };
}

function mapStudentRow(row: Record<string, unknown>): StudentRecord {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    standard: String(row.standard || siteData.standard),
    joiningDate: String(row.joining_date || ''),
    status: row.status === 'left' ? 'left' : 'active',
    createdAt: row.created_at ? String(row.created_at) : undefined,
  };
}

function mapTestRow(row: Record<string, unknown>): TestRecord {
  const marksRel = row.marks as Array<{ count?: number }> | undefined;
  const marksCount =
    Array.isArray(marksRel) && marksRel.length > 0 && typeof marksRel[0]?.count === 'number'
      ? marksRel[0].count
      : 0;

  return {
    id: String(row.id),
    title: String(row.title || ''),
    subject: String(row.subject || ''),
    testDate: String(row.test_date || ''),
    totalMarks: Number(row.total_marks || 0),
    fileName: row.file_name ? String(row.file_name) : null,
    fileType: row.file_type ? String(row.file_type) : null,
    filePath: row.file_path ? String(row.file_path) : null,
    marksCount,
  };
}

// --- Students & Parents ---

export async function getStudents(): Promise<StudentWithParent[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('students')
    .select('*, parents(*)')
    .order('name', { ascending: true });

  if (error) {
    throw friendlyError(error, 'Unable to load students.');
  }

  return (data || []).map((row) => {
    const r = row as Record<string, unknown>;
    const rawParents = r.parents;
    const parentObj = Array.isArray(rawParents) ? rawParents[0] : rawParents;
    return {
      ...mapStudentRow(r),
      parent: parentObj ? mapParentRow(parentObj as Record<string, unknown>) : null,
    };
  });
}

export async function addStudent(input: {
  studentName: string;
  joiningDate: string;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  whatsappNumber?: string;
}): Promise<string> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.rpc('add_student_with_parent', {
    p_student_name: input.studentName.trim(),
    p_joining_date: input.joiningDate,
    p_parent_name: input.parentName.trim(),
    p_email: input.parentEmail.trim().toLowerCase(),
    p_phone: input.parentPhone.trim(),
    p_whatsapp: input.whatsappNumber?.trim() || null,
  });

  if (error) {
    if (
      error.code === '23505' ||
      /already exists|unique|duplicate/i.test(error.message || '')
    ) {
      throw new Error('This email is already registered');
    }
    throw friendlyError(error, 'Unable to add student. Please verify the details.');
  }

  return String(data);
}

export async function updateStudent(
  studentId: string,
  input: {
    studentName: string;
    joiningDate: string;
    status: 'active' | 'left';
    parentName: string;
    parentEmail: string;
    parentPhone: string;
    whatsappNumber?: string;
  },
): Promise<void> {
  assertSupabaseConfigured();
  const { error: studentError } = await supabase
    .from('students')
    .update({
      name: input.studentName.trim(),
      joining_date: input.joiningDate,
      status: input.status,
    })
    .eq('id', studentId);

  if (studentError) {
    throw friendlyError(studentError, 'Unable to update student details.');
  }

  const { error: parentError } = await supabase
    .from('parents')
    .update({
      name: input.parentName.trim(),
      email: input.parentEmail.trim().toLowerCase(),
      phone: input.parentPhone.trim(),
      whatsapp_number: input.whatsappNumber?.trim() || null,
    })
    .eq('student_id', studentId);

  if (parentError) {
    if (
      parentError.code === '23505' ||
      /already exists|unique|duplicate/i.test(parentError.message || '')
    ) {
      throw new Error('This email is already registered');
    }
    throw friendlyError(parentError, 'Unable to update parent details.');
  }
}

export async function setStudentStatus(
  studentId: string,
  status: 'active' | 'left',
): Promise<void> {
  assertSupabaseConfigured();
  const { error } = await supabase
    .from('students')
    .update({ status })
    .eq('id', studentId);

  if (error) {
    throw friendlyError(error, 'Unable to update student status.');
  }
}

// --- Tests & Storage ---

export async function getTests(): Promise<TestRecord[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('tests')
    .select('*, marks(count)')
    .order('test_date', { ascending: false });

  if (error) {
    throw friendlyError(error, 'Unable to load tests.');
  }

  return (data || []).map((row) => mapTestRow(row as Record<string, unknown>));
}

async function uploadPaperFile(
  testId: string,
  rawFile: File,
): Promise<{ fileName: string; fileType: string; filePath: string }> {
  validatePaperFile(rawFile);
  const processedFile = await compressImageIfNeeded(rawFile);
  const safeName = sanitizeFileName(processedFile.name);
  const storagePath = `${testId}/${Date.now()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, processedFile, {
      contentType: processedFile.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    throw friendlyError(uploadError, 'Unable to upload question paper.');
  }

  return {
    fileName: processedFile.name,
    fileType: processedFile.type || 'application/octet-stream',
    filePath: storagePath,
  };
}

export async function addTest(
  input: {
    title: string;
    subject: string;
    testDate: string;
    totalMarks: number;
  },
  file?: File | null,
): Promise<TestRecord> {
  assertSupabaseConfigured();
  if (file) {
    validatePaperFile(file);
  }

  const { data: inserted, error: insertError } = await supabase
    .from('tests')
    .insert({
      title: input.title.trim(),
      subject: input.subject,
      test_date: input.testDate,
      total_marks: input.totalMarks,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw friendlyError(insertError, 'Unable to create test.');
  }

  const testId = String((inserted as Record<string, unknown>).id);
  if (file) {
    try {
      const uploaded = await uploadPaperFile(testId, file);
      const { data: updated, error: updateError } = await supabase
        .from('tests')
        .update({
          file_name: uploaded.fileName,
          file_type: uploaded.fileType,
          file_path: uploaded.filePath,
        })
        .eq('id', testId)
        .select('*')
        .single();

      if (updateError || !updated) {
        throw friendlyError(updateError, 'Test created, but failed to attach file metadata.');
      }
      return mapTestRow(updated as Record<string, unknown>);
    } catch (err) {
      await supabase.from('tests').delete().eq('id', testId);
      throw err;
    }
  }

  return mapTestRow(inserted as Record<string, unknown>);
}

export async function updateTest(
  testId: string,
  input: {
    title: string;
    subject: string;
    testDate: string;
    totalMarks: number;
  },
  file?: File | null,
  previousFilePath?: string | null,
): Promise<void> {
  assertSupabaseConfigured();
  if (file) {
    validatePaperFile(file);
  }

  const updatePayload: Record<string, unknown> = {
    title: input.title.trim(),
    subject: input.subject,
    test_date: input.testDate,
    total_marks: input.totalMarks,
  };

  if (file) {
    const uploaded = await uploadPaperFile(testId, file);
    updatePayload.file_name = uploaded.fileName;
    updatePayload.file_type = uploaded.fileType;
    updatePayload.file_path = uploaded.filePath;
  }

  const { error } = await supabase
    .from('tests')
    .update(updatePayload)
    .eq('id', testId);

  if (error) {
    throw friendlyError(error, 'Unable to update test.');
  }

  if (file && previousFilePath) {
    await supabase.storage.from(BUCKET_NAME).remove([previousFilePath]);
  }
}

export async function deleteTest(
  testId: string,
  existingFilePath?: string | null,
): Promise<void> {
  assertSupabaseConfigured();
  let filePath = existingFilePath ?? null;

  if (filePath === null) {
    const { data } = await supabase
      .from('tests')
      .select('file_path')
      .eq('id', testId)
      .maybeSingle();
    filePath = data?.file_path ? String(data.file_path) : null;
  }

  if (filePath) {
    await supabase.storage.from(BUCKET_NAME).remove([filePath]);
  }

  const { error } = await supabase.from('tests').delete().eq('id', testId);
  if (error) {
    throw friendlyError(error, 'Unable to delete test.');
  }
}

export async function getPdfUrl(filePath: string): Promise<string> {
  assertSupabaseConfigured();
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUrl(filePath, 300);

  if (error || !data?.signedUrl) {
    throw friendlyError(error, 'Unable to generate paper preview link.');
  }
  return data.signedUrl;
}

// --- Marks ---

export async function getMarksForTest(testId: string): Promise<MarkRecord[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('marks')
    .select('*')
    .eq('test_id', testId);

  if (error) {
    throw friendlyError(error, 'Unable to load marks for this test.');
  }

  return (data || []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      id: String(r.id),
      testId: String(r.test_id),
      studentId: String(r.student_id),
      marksObtained: Number(r.marks_obtained),
      remark: r.remark ? String(r.remark) : null,
    };
  });
}

export async function saveMarks(
  testId: string,
  rows: Array<{
    studentId: string;
    marksObtained: number | null;
    remark: string;
  }>,
): Promise<void> {
  assertSupabaseConfigured();

  const upsertRows = rows
    .filter((r) => r.marksObtained !== null)
    .map((r) => ({
      test_id: testId,
      student_id: r.studentId,
      marks_obtained: r.marksObtained as number,
      remark: r.remark.trim() || null,
    }));

  const clearedStudentIds = rows
    .filter((r) => r.marksObtained === null)
    .map((r) => r.studentId);

  if (upsertRows.length > 0) {
    const { error } = await supabase
      .from('marks')
      .upsert(upsertRows, { onConflict: 'test_id,student_id' });

    if (error) {
      throw friendlyError(error, 'Unable to save marks.');
    }
  }

  if (clearedStudentIds.length > 0) {
    const { error } = await supabase
      .from('marks')
      .delete()
      .eq('test_id', testId)
      .in('student_id', clearedStudentIds);

    if (error) {
      throw friendlyError(error, 'Unable to update cleared marks.');
    }
  }
}

// --- Parent Queries (RLS Scoped) ---

export async function getMyStudent(): Promise<StudentRecord | null> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .maybeSingle();

  if (error) {
    throw friendlyError(error, 'Unable to load student profile.');
  }
  return data ? mapStudentRow(data as Record<string, unknown>) : null;
}

export async function getMyParent(): Promise<ParentRecord | null> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('parents')
    .select('*')
    .maybeSingle();

  if (error) {
    throw friendlyError(error, 'Unable to load parent profile.');
  }
  return data ? mapParentRow(data as Record<string, unknown>) : null;
}

export async function getMarksForStudent(studentId: string): Promise<StudentMarkWithTest[]> {
  assertSupabaseConfigured();
  const { data, error } = await supabase
    .from('marks')
    .select('*, tests(*)')
    .eq('student_id', studentId);

  if (error) {
    throw friendlyError(error, 'Unable to load test results.');
  }

  const mapped: StudentMarkWithTest[] = [];
  for (const raw of data || []) {
    const row = raw as Record<string, unknown>;
    const testObj = Array.isArray(row.tests) ? row.tests[0] : row.tests;
    if (!testObj) continue;
    const t = testObj as Record<string, unknown>;
    const totalMarks = Number(t.total_marks || 1);
    const marksObtained = Number(row.marks_obtained || 0);
    mapped.push({
      markId: String(row.id),
      testId: String(t.id),
      studentId: String(row.student_id),
      marksObtained,
      remark: row.remark ? String(row.remark) : null,
      title: String(t.title || ''),
      subject: String(t.subject || ''),
      testDate: String(t.test_date || ''),
      totalMarks,
      fileName: t.file_name ? String(t.file_name) : null,
      fileType: t.file_type ? String(t.file_type) : null,
      filePath: t.file_path ? String(t.file_path) : null,
      percentage: Math.round((marksObtained / totalMarks) * 1000) / 10,
    });
  }

  mapped.sort((a, b) => b.testDate.localeCompare(a.testDate));
  return mapped;
}

// --- Admin Overview ---

export async function getOverviewStats(): Promise<OverviewData> {
  assertSupabaseConfigured();
  const monthPrefix = new Date().toISOString().slice(0, 7);

  const [studentsRes, testsRes, recentMarksRes] = await Promise.all([
    supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'active'),
    supabase.from('tests').select('id, test_date'),
    supabase
      .from('marks')
      .select('id, marks_obtained, remark, students(name), tests(title, subject, test_date, total_marks)')
      .order('id', { ascending: false })
      .limit(5),
  ]);

  if (studentsRes.error) throw friendlyError(studentsRes.error, 'Unable to load overview.');
  if (testsRes.error) throw friendlyError(testsRes.error, 'Unable to load tests count.');
  if (recentMarksRes.error) throw friendlyError(recentMarksRes.error, 'Unable to load recent marks.');

  const allTests = (testsRes.data || []) as Array<{ id: string; test_date: string }>;
  const testsThisMonth = allTests.filter((t) =>
    String(t.test_date || '').startsWith(monthPrefix),
  ).length;

  const recentMarks = (recentMarksRes.data || []).map((raw) => {
    const r = raw as Record<string, unknown>;
    const studentRel = Array.isArray(r.students) ? r.students[0] : r.students;
    const testRel = Array.isArray(r.tests) ? r.tests[0] : r.tests;
    const s = (studentRel || {}) as Record<string, unknown>;
    const t = (testRel || {}) as Record<string, unknown>;
    const totalMarks = Number(t.total_marks || 1);
    const marksObtained = Number(r.marks_obtained || 0);
    return {
      id: String(r.id),
      marksObtained,
      remark: r.remark ? String(r.remark) : null,
      studentName: String(s.name || 'Student'),
      testTitle: String(t.title || 'Test'),
      subject: String(t.subject || ''),
      testDate: String(t.test_date || ''),
      totalMarks,
      percentage: Math.round((marksObtained / totalMarks) * 1000) / 10,
    };
  });

  return {
    stats: {
      activeStudents: studentsRes.count ?? 0,
      testsThisMonth,
      totalTests: allTests.length,
    },
    recentMarks,
  };
}
