import {
  Award,
  BookOpen,
  ClipboardCheck,
  Edit3,
  Eye,
  LayoutDashboard,
  LogOut,
  Plus,
  Power,
  Search,
  Smartphone,
  Trash2,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  addStudent,
  addTest,
  deleteTest,
  getMarksForTest,
  getOverviewStats,
  getPdfUrl,
  getStudents,
  getTests,
  saveMarks,
  setStudentStatus,
  updateStudent,
  updateTest,
  type OverviewData,
  type StudentWithParent,
  type TestRecord,
} from '../lib/dataService';
import { siteData } from '../siteData';
import { BrandLogo } from './BrandLogo';
import { FilePreview } from './FilePreview';
import { PWAInstallButton } from './PWAInstallButton';
import { useToast } from './Toast';

interface AdminDashboardProps {
  adminName: string;
  onLogout: () => void;
}

type AdminTab = 'overview' | 'students' | 'tests' | 'marks';

function formatFullDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function AdminDashboard({ adminName, onLogout }: AdminDashboardProps) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<AdminTab>('overview');
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [students, setStudents] = useState<StudentWithParent[]>([]);
  const [tests, setTests] = useState<TestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Students state
  const [studentQuery, setStudentQuery] = useState('');
  const [studentModalMode, setStudentModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentWithParent | null>(null);

  // Tests state
  const [testModalMode, setTestModalMode] = useState<'add' | 'edit' | null>(null);
  const [editingTest, setEditingTest] = useState<TestRecord | null>(null);
  const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    fileName: string;
    fileType: string | null;
    title: string;
  } | null>(null);

  // Marks state
  const [selectedTestId, setSelectedTestId] = useState<string>('');
  const [marksInputs, setMarksInputs] = useState<
    Record<string, { marks: string; remark: string }>
  >({});
  const [marksLoading, setMarksLoading] = useState(false);
  const [marksSaving, setMarksSaving] = useState(false);

  async function loadAllData() {
    setLoading(true);
    setError(null);
    try {
      const [ov, st, ts] = await Promise.all([
        getOverviewStats(),
        getStudents(),
        getTests(),
      ]);
      setOverview(ov);
      setStudents(st);
      setTests(ts);
      setSelectedTestId((prev) => {
        if (prev && ts.some((t) => t.id === prev)) return prev;
        return ts[0]?.id || '';
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load dashboard data.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAllData();
  }, []);

  const activeStudents = useMemo(
    () => students.filter((s) => s.status === 'active'),
    [students],
  );

  const selectedTest = useMemo(
    () => tests.find((t) => t.id === selectedTestId) || null,
    [tests, selectedTestId],
  );

  async function loadMarksForSelectedTest(testId: string) {
    if (!testId) return;
    setMarksLoading(true);
    try {
      const existing = await getMarksForTest(testId);
      const mapByStudent = new Map(existing.map((m) => [m.studentId, m]));
      const nextInputs: Record<string, { marks: string; remark: string }> = {};
      for (const s of activeStudents) {
        const mark = mapByStudent.get(s.id);
        nextInputs[s.id] = {
          marks: mark ? String(mark.marksObtained) : '',
          remark: mark?.remark || '',
        };
      }
      setMarksInputs(nextInputs);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to load test marks.',
        'error',
      );
    } finally {
      setMarksLoading(false);
    }
  }

  useEffect(() => {
    if (tab === 'marks' && selectedTestId) {
      void loadMarksForSelectedTest(selectedTestId);
    }
  }, [tab, selectedTestId, activeStudents.length]);

  const filteredStudents = useMemo(() => {
    const q = studentQuery.trim().toLowerCase();
    if (!q) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.parent?.name || '').toLowerCase().includes(q) ||
        (s.parent?.email || '').toLowerCase().includes(q),
    );
  }, [students, studentQuery]);

  async function handleToggleStudentStatus(row: StudentWithParent) {
    const nextStatus = row.status === 'active' ? 'left' : 'active';
    try {
      await setStudentStatus(row.id, nextStatus);
      showToast(
        `${row.name} marked as ${nextStatus === 'active' ? 'active' : 'inactive'}.`,
        'success',
      );
      await loadAllData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to update student status.',
        'error',
      );
    }
  }

  async function handleDeleteTest(test: TestRecord) {
    try {
      await deleteTest(test.id, test.filePath);
      setDeletingTestId(null);
      showToast('Test deleted.', 'success');
      await loadAllData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to delete test.',
        'error',
      );
    }
  }

  async function handlePreviewTestPaper(test: TestRecord) {
    if (!test.filePath) return;
    try {
      const signedUrl = await getPdfUrl(test.filePath);
      setPreviewFile({
        url: signedUrl,
        fileName: test.fileName || `${test.title}.pdf`,
        fileType: test.fileType,
        title: test.title,
      });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to preview paper.',
        'error',
      );
    }
  }

  async function handleSaveAllMarks() {
    if (!selectedTest) return;
    const max = selectedTest.totalMarks;
    const rows: Array<{ studentId: string; marksObtained: number | null; remark: string }> = [];

    for (const s of activeStudents) {
      const raw = marksInputs[s.id]?.marks.trim() || '';
      const remark = marksInputs[s.id]?.remark || '';
      if (raw === '') {
        rows.push({ studentId: s.id, marksObtained: null, remark });
        continue;
      }
      const num = Number(raw);
      if (!Number.isFinite(num) || num < 0 || num > max) {
        showToast(
          `Invalid marks for ${s.name}. Enter a value between 0 and ${max}.`,
          'error',
        );
        return;
      }
      rows.push({ studentId: s.id, marksObtained: num, remark });
    }

    setMarksSaving(true);
    try {
      await saveMarks(selectedTest.id, rows);
      showToast('All marks saved successfully.', 'success');
      await loadAllData();
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Failed to save marks.',
        'error',
      );
    } finally {
      setMarksSaving(false);
    }
  }

  const navItems = [
    { id: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { id: 'students', label: 'Students', Icon: Users },
    { id: 'tests', label: 'Tests', Icon: BookOpen },
    { id: 'marks', label: 'Enter Marks', Icon: ClipboardCheck },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F7F8FA] flex flex-col lg:flex-row pb-20 lg:pb-0">
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-[#0F2A4A] text-white shrink-0 sticky top-0 h-screen">
        <div className="p-5 flex items-center gap-3 border-b border-white/10">
          <BrandLogo size="sm" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-white truncate">{siteData.tuitionName}</p>
            <p className="text-xs text-slate-300 truncate">{siteData.standard} Standard Admin</p>
          </div>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {navItems.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`w-full min-h-[44px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-[#F5A623] text-[#0F2A4A] font-semibold'
                    : 'text-slate-200 hover:bg-white/10'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-3">
          <div className="text-xs">
            <p className="text-slate-400">Signed in as</p>
            <p className="font-semibold text-white truncate">{adminName}</p>
          </div>
          <button
            type="button"
            onClick={onLogout}
            className="w-full min-h-[40px] px-3 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-semibold text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <header className="lg:hidden sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0F2A4A] truncate">{siteData.tuitionName}</p>
              <p className="text-xs text-slate-500 truncate">Teacher Console</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton variant="compact" />
            <button
              type="button"
              onClick={onLogout}
              aria-label="Logout"
              className="min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-100 cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-8 py-6 max-w-6xl w-full mx-auto">
        {error && (
          <div
            role="alert"
            className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between gap-3"
          >
            <span>{error}</span>
            <button
              type="button"
              onClick={() => void loadAllData()}
              className="text-xs font-semibold underline cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="h-24 rounded-2xl bg-slate-200/80" />
              <div className="h-24 rounded-2xl bg-slate-200/80" />
              <div className="h-24 rounded-2xl bg-slate-200/80" />
            </div>
            <div className="h-64 rounded-2xl bg-white border border-slate-200" />
          </div>
        ) : (
          <>
            {tab === 'overview' && overview && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0F2A4A]">Overview</h1>
                    <p className="text-xs text-slate-500">
                      {siteData.standard} Standard · {siteData.tuitionName}
                    </p>
                  </div>
                  <div className="hidden lg:block">
                    <PWAInstallButton variant="compact" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="rounded-2xl bg-white border border-slate-200 p-5">
                    <p className="text-xs font-medium text-slate-500">Active Students</p>
                    <p className="mt-2 text-3xl font-bold font-mono-tabular text-[#0F2A4A]">
                      {overview.stats.activeStudents}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 p-5">
                    <p className="text-xs font-medium text-slate-500">Tests This Month</p>
                    <p className="mt-2 text-3xl font-bold font-mono-tabular text-[#0F2A4A]">
                      {overview.stats.testsThisMonth}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white border border-slate-200 p-5">
                    <p className="text-xs font-medium text-slate-500">Total Tests</p>
                    <p className="mt-2 text-3xl font-bold font-mono-tabular text-[#0F2A4A]">
                      {overview.stats.totalTests}
                    </p>
                  </div>
                </div>

                <section className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
                    <h2 className="text-base font-bold text-[#0F2A4A]">Last 5 Mark Entries</h2>
                    <button
                      type="button"
                      onClick={() => setTab('marks')}
                      className="text-xs font-semibold text-[#0F2A4A] hover:underline cursor-pointer"
                    >
                      Enter marks
                    </button>
                  </div>

                  {overview.recentMarks.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-500">
                      No marks entered yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {overview.recentMarks.map((entry) => (
                        <div
                          key={entry.id}
                          className="px-5 py-3.5 flex items-center justify-between gap-4"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-[#0F2A4A] truncate">
                              {entry.studentName}
                            </p>
                            <p className="text-xs text-slate-500 truncate">
                              {entry.subject} · {entry.testTitle}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold font-mono-tabular text-[#0F2A4A]">
                              {entry.marksObtained} / {entry.totalMarks}
                            </p>
                            <p className="text-xs font-mono-tabular text-[#B47109]">
                              {entry.percentage}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>
            )}

            {tab === 'students' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0F2A4A]">Students</h1>
                    <p className="text-xs text-slate-500">
                      Manage {siteData.standard} standard students and parent accounts
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingStudent(null);
                      setStudentModalMode('add');
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0F2A4A] hover:bg-[#163861] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Student</span>
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="search"
                    value={studentQuery}
                    onChange={(e) => setStudentQuery(e.target.value)}
                    placeholder="Search by student, parent name, or email..."
                    className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-white border border-slate-200 text-sm text-[#0F2A4A] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
                  />
                </div>

                {filteredStudents.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
                    No students found.
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                    {filteredStudents.map((row) => {
                      const hasLoggedIn = Boolean(row.parent?.authUserId);
                      return (
                        <div
                          key={row.id}
                          className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                        >
                          <div className="min-w-0 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-bold text-[#0F2A4A]">{row.name}</h2>
                              <span
                                className={`text-xs font-semibold ${
                                  row.status === 'active' ? 'text-emerald-700' : 'text-slate-400'
                                }`}
                              >
                                · {row.status === 'active' ? 'Active' : 'Left'}
                              </span>
                            </div>
                            <p className="text-xs text-slate-600">
                              Parent: <strong className="font-semibold">{row.parent?.name || '—'}</strong> ·{' '}
                              {row.parent?.email || '—'} ·{' '}
                              <span className="font-mono-tabular">{row.parent?.phone || '—'}</span>
                            </p>
                            <p className="text-xs text-slate-500">
                              Joined <span className="font-mono-tabular">{formatFullDate(row.joiningDate)}</span> · Parent login:{' '}
                              <span
                                className={`font-semibold ${
                                  hasLoggedIn ? 'text-emerald-700' : 'text-amber-700'
                                }`}
                              >
                                {hasLoggedIn ? 'Active' : 'Not logged in yet'}
                              </span>
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled
                              title="Coming soon"
                              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-400 inline-flex items-center gap-1.5 cursor-not-allowed"
                            >
                              <Smartphone className="w-3.5 h-3.5" />
                              <span>Log out device</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setEditingStudent(row);
                                setStudentModalMode('edit');
                              }}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-[#F7F8FA] hover:bg-slate-100 text-xs font-semibold text-[#0F2A4A] inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => void handleToggleStudentStatus(row)}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Power className="w-3.5 h-3.5" />
                              <span>{row.status === 'active' ? 'Deactivate' : 'Reactivate'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {tab === 'tests' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-[#0F2A4A]">Tests</h1>
                    <p className="text-xs text-slate-500">Sorted newest first</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingTest(null);
                      setTestModalMode('add');
                    }}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-[#0F2A4A] hover:bg-[#163861] text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Create Test</span>
                  </button>
                </div>

                {tests.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
                    No tests created yet.
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
                    {tests.map((test) => (
                      <div
                        key={test.id}
                        className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-semibold text-[#0F2A4A]">{test.subject}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">{formatFullDate(test.testDate)}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">Max {test.totalMarks} marks</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono-tabular">{test.marksCount} graded</span>
                          </div>
                          <h2 className="mt-1 text-base font-bold text-[#0F2A4A]">{test.title}</h2>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedTestId(test.id);
                              setTab('marks');
                            }}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-[#F5A623]/15 hover:bg-[#F5A623]/25 text-xs font-semibold text-[#0F2A4A] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Award className="w-3.5 h-3.5" />
                            <span>Marks</span>
                          </button>

                          {test.filePath && (
                            <button
                              type="button"
                              onClick={() => void handlePreviewTestPaper(test)}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-[#F7F8FA] hover:bg-slate-100 text-xs font-semibold text-[#0F2A4A] inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View Paper</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              setEditingTest(test);
                              setTestModalMode('edit');
                            }}
                            className="min-h-[40px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-[#0F2A4A] inline-flex items-center gap-1.5 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>

                          {deletingTestId === test.id ? (
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => void handleDeleteTest(test)}
                                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-red-600 text-white text-xs font-semibold cursor-pointer"
                              >
                                Confirm Delete
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeletingTestId(null)}
                                className="min-h-[40px] px-2.5 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 cursor-pointer"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeletingTestId(test.id)}
                              aria-label={`Delete ${test.title}`}
                              className="min-h-[40px] px-3 py-1.5 rounded-xl border border-red-200 text-red-700 hover:bg-red-50 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {tab === 'marks' && (
              <div className="space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                  <div className="flex-1 max-w-md">
                    <label
                      htmlFor="select-test-marks"
                      className="block text-xs font-semibold text-slate-500 mb-1.5"
                    >
                      Select Test
                    </label>
                    <select
                      id="select-test-marks"
                      value={selectedTestId}
                      onChange={(e) => setSelectedTestId(e.target.value)}
                      className="w-full min-h-[44px] px-3.5 rounded-xl bg-white border border-slate-200 text-sm font-semibold text-[#0F2A4A] focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
                    >
                      {tests.length === 0 ? (
                        <option value="">No tests available</option>
                      ) : (
                        tests.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.subject} — {t.title} ({formatFullDate(t.testDate)})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  {selectedTest && (
                    <button
                      type="button"
                      disabled={marksSaving || marksLoading || activeStudents.length === 0}
                      onClick={() => void handleSaveAllMarks()}
                      className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0F2A4A] hover:bg-[#163861] disabled:opacity-50 text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {marksSaving ? 'Saving...' : 'Save All'}
                    </button>
                  )}
                </div>

                {marksLoading ? (
                  <div className="h-64 rounded-2xl bg-white border border-slate-200 animate-pulse" />
                ) : !selectedTest ? (
                  <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
                    Create a test first to enter marks.
                  </div>
                ) : activeStudents.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-slate-200 p-10 text-center text-sm text-slate-500">
                    No active students found.
                  </div>
                ) : (
                  <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                    <div className="px-5 py-3.5 bg-[#F7F8FA] border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
                      <span>Active Students ({activeStudents.length})</span>
                      <span className="font-mono-tabular font-semibold text-[#0F2A4A]">
                        Valid range: 0 – {selectedTest.totalMarks}
                      </span>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {activeStudents.map((s) => {
                        const val = marksInputs[s.id]?.marks ?? '';
                        const num = val === '' ? null : Number(val);
                        const isInvalid =
                          val !== '' &&
                          (!Number.isFinite(num) ||
                            num! < 0 ||
                            num! > selectedTest.totalMarks);

                        return (
                          <div
                            key={s.id}
                            className="p-4 sm:px-5 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
                          >
                            <div className="sm:col-span-4 min-w-0">
                              <p className="text-sm font-semibold text-[#0F2A4A] truncate">
                                {s.name}
                              </p>
                            </div>

                            <div className="sm:col-span-3">
                              <div className="relative flex items-center">
                                <input
                                  type="number"
                                  step="0.5"
                                  min={0}
                                  max={selectedTest.totalMarks}
                                  aria-label={`Marks for ${s.name}`}
                                  value={val}
                                  onChange={(e) =>
                                    setMarksInputs((prev) => ({
                                      ...prev,
                                      [s.id]: {
                                        marks: e.target.value,
                                        remark: prev[s.id]?.remark ?? '',
                                      },
                                    }))
                                  }
                                  placeholder="—"
                                  className={`w-full min-h-[42px] pl-3 pr-14 rounded-xl border font-mono-tabular text-sm text-[#0F2A4A] focus:outline-none focus:ring-2 ${
                                    isInvalid
                                      ? 'border-red-400 bg-red-50 focus:ring-red-300'
                                      : 'border-slate-200 bg-[#F7F8FA] focus:bg-white focus:ring-[#F5A623]/60'
                                  }`}
                                />
                                <span className="absolute right-3 text-xs font-mono-tabular text-slate-400 pointer-events-none">
                                  / {selectedTest.totalMarks}
                                </span>
                              </div>
                            </div>

                            <div className="sm:col-span-5">
                              <input
                                type="text"
                                aria-label={`Remark for ${s.name}`}
                                value={marksInputs[s.id]?.remark ?? ''}
                                onChange={(e) =>
                                  setMarksInputs((prev) => ({
                                    ...prev,
                                    [s.id]: {
                                      marks: prev[s.id]?.marks ?? '',
                                      remark: e.target.value,
                                    },
                                  }))
                                }
                                placeholder="Optional teacher remark"
                                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm text-[#0F2A4A] placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      <nav
        aria-label="Admin navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="grid grid-cols-4 h-15 items-center">
          {navItems.map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 cursor-pointer ${
                  active ? 'text-[#0F2A4A]' : 'text-slate-400 hover:text-slate-600'
                }`}
              >
                <Icon className={`w-5 h-5 ${active ? 'text-[#F5A623]' : ''}`} />
                <span className="text-[10px] font-semibold tracking-tight">{label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {studentModalMode && (
        <StudentFormModal
          mode={studentModalMode}
          initial={editingStudent}
          onClose={() => setStudentModalMode(null)}
          onSaved={async () => {
            setStudentModalMode(null);
            await loadAllData();
          }}
        />
      )}

      {testModalMode && (
        <TestFormModal
          mode={testModalMode}
          initial={editingTest}
          onClose={() => setTestModalMode(null)}
          onSaved={async () => {
            setTestModalMode(null);
            await loadAllData();
          }}
        />
      )}

      {previewFile && (
        <FilePreview
          url={previewFile.url}
          fileName={previewFile.fileName}
          fileType={previewFile.fileType}
          title={previewFile.title}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}

function StudentFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  initial: StudentWithParent | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [studentName, setStudentName] = useState(initial?.name || '');
  const [parentName, setParentName] = useState(initial?.parent?.name || '');
  const [parentEmail, setParentEmail] = useState(initial?.parent?.email || '');
  const [parentPhone, setParentPhone] = useState(initial?.parent?.phone || '');
  const [whatsappNumber, setWhatsappNumber] = useState(
    initial?.parent?.whatsappNumber || '',
  );
  const [joiningDate, setJoiningDate] = useState(
    initial?.joiningDate || new Date().toISOString().slice(0, 10),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (mode === 'add') {
        await addStudent({
          studentName,
          joiningDate,
          parentName,
          parentEmail,
          parentPhone,
          whatsappNumber,
        });
        showToast('Student and parent added.', 'success');
      } else if (initial) {
        await updateStudent(initial.id, {
          studentName,
          joiningDate,
          status: initial.status,
          parentName,
          parentEmail,
          parentPhone,
          whatsappNumber,
        });
        showToast('Student details updated.', 'success');
      }
      await onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save student.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-[#0F2A4A]">
              {mode === 'add' ? 'Add Student & Parent' : 'Edit Student Details'}
            </h2>
            <p className="text-xs text-slate-500">Standard is fixed to {siteData.standard}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
                Student Name *
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
                Joining Date *
              </label>
              <input
                type="date"
                required
                value={joiningDate}
                onChange={(e) => setJoiningDate(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm font-mono-tabular focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
                Parent Name *
              </label>
              <input
                type="text"
                required
                value={parentName}
                onChange={(e) => setParentName(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
                Parent Email * (Unique)
              </label>
              <input
                type="email"
                required
                value={parentEmail}
                onChange={(e) => setParentEmail(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
                Parent Phone *
              </label>
              <input
                type="tel"
                required
                value={parentPhone}
                onChange={(e) => setParentPhone(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm font-mono-tabular focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
                WhatsApp Number (Optional)
              </label>
              <input
                type="tel"
                value={whatsappNumber}
                onChange={(e) => setWhatsappNumber(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm font-mono-tabular focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
              />
            </div>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 font-medium"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0F2A4A] hover:bg-[#163861] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
            >
              {saving ? 'Saving...' : mode === 'add' ? 'Add Student' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function TestFormModal({
  mode,
  initial,
  onClose,
  onSaved,
}: {
  mode: 'add' | 'edit';
  initial: TestRecord | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const { showToast } = useToast();
  const [title, setTitle] = useState(initial?.title || '');
  const [subject, setSubject] = useState<string>(initial?.subject || siteData.subjects[0]);
  const [testDate, setTestDate] = useState(
    initial?.testDate || new Date().toISOString().slice(0, 10),
  );
  const [totalMarks, setTotalMarks] = useState(
    initial ? String(initial.totalMarks) : '40',
  );
  const [paperFile, setPaperFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const maxNum = Number(totalMarks);
    if (!Number.isFinite(maxNum) || maxNum <= 0) {
      setError('Total marks must be greater than 0.');
      return;
    }

    setSaving(true);
    try {
      if (mode === 'add') {
        await addTest(
          { title, subject, testDate, totalMarks: maxNum },
          paperFile,
        );
        showToast('Test created successfully.', 'success');
      } else if (initial) {
        await updateTest(
          initial.id,
          { title, subject, testDate, totalMarks: maxNum },
          paperFile,
          initial.filePath,
        );
        showToast('Test updated successfully.', 'success');
      }
      await onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to save test.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/50 backdrop-blur-xs p-0 sm:p-4">
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl bg-white p-6 shadow-xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-[#0F2A4A]">
            {mode === 'add' ? 'Create New Test' : 'Edit Test'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
              Test Title *
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Unit Test 2: Trigonometry"
              className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
                Subject *
              </label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
              >
                {siteData.subjects.map((subj) => (
                  <option key={subj} value={subj}>
                    {subj}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
                Test Date *
              </label>
              <input
                type="date"
                required
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm font-mono-tabular focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
                Total Marks *
              </label>
              <input
                type="number"
                min={1}
                step="0.5"
                required
                value={totalMarks}
                onChange={(e) => setTotalMarks(e.target.value)}
                className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 bg-[#F7F8FA] text-sm font-mono-tabular focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#F5A623]/60"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#0F2A4A] mb-1">
              Question Paper (PDF, JPG, PNG, WEBP — max 10 MB){' '}
              {mode === 'edit' && initial?.filePath ? '(Replace existing)' : '(Optional)'}
            </label>
            <label className="flex items-center justify-center gap-2 min-h-[48px] px-4 rounded-xl border border-dashed border-slate-300 bg-[#F7F8FA] hover:bg-slate-100 text-xs font-semibold text-[#0F2A4A] cursor-pointer transition-colors">
              <Upload className="w-4 h-4 text-slate-500" />
              <span className="truncate">
                {paperFile
                  ? paperFile.name
                  : initial?.fileName
                    ? `Current: ${initial.fileName}`
                    : 'Choose PDF or Image (max 10 MB)'}
              </span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,.pdf,.jpg,.jpeg,.png,.webp"
                className="sr-only"
                onChange={(e) => setPaperFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          {error && (
            <div
              role="alert"
              className="rounded-xl bg-red-50 border border-red-200 px-3.5 py-2.5 text-xs text-red-700 font-medium"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="min-h-[44px] px-5 py-2 rounded-xl bg-[#0F2A4A] hover:bg-[#163861] disabled:opacity-60 text-white text-sm font-semibold cursor-pointer"
            >
              {saving ? 'Saving...' : mode === 'add' ? 'Create Test' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
