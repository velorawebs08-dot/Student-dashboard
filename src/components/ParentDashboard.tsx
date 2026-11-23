import {
  Calendar,
  Eye,
  FileText,
  Home,
  LogOut,
  MessageSquareQuote,
  TrendingUp,
  User,
} from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  getMarksForStudent,
  getMyParent,
  getMyStudent,
  getPdfUrl,
  type ParentRecord,
  type StudentMarkWithTest,
  type StudentRecord,
} from '../lib/dataService';
import { siteData } from '../siteData';
import { BrandLogo } from './BrandLogo';
import { FilePreview } from './FilePreview';
import { PWAInstallButton } from './PWAInstallButton';
import { useToast } from './Toast';

interface ParentDashboardProps {
  onLogout: () => void;
}

type ParentTab = 'home' | 'tests' | 'profile';

function formatShortDate(isoDate: string): string {
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

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

interface ChartPoint {
  testId: string;
  label: string;
  fullDate: string;
  title: string;
  subject: string;
  marksText: string;
  percentage: number;
}

export function ParentDashboard({ onLogout }: ParentDashboardProps) {
  const { showToast } = useToast();
  const [tab, setTab] = useState<ParentTab>('home');
  const [student, setStudent] = useState<StudentRecord | null>(null);
  const [parent, setParent] = useState<ParentRecord | null>(null);
  const [results, setResults] = useState<StudentMarkWithTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState<string>('All');
  const [openingTestId, setOpeningTestId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<{
    url: string;
    fileName: string;
    fileType: string | null;
    title: string;
  } | null>(null);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const [studentRow, parentRow] = await Promise.all([
        getMyStudent(),
        getMyParent(),
      ]);

      if (!studentRow) {
        throw new Error('Student record not found for your account.');
      }

      const markRows = await getMarksForStudent(studentRow.id);
      setStudent(studentRow);
      setParent(parentRow);
      setResults(markRows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to load student marks.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const latestTest: StudentMarkWithTest | null = useMemo(() => {
    if (results.length === 0) return null;
    return results[0];
  }, [results]);

  const summaryStats = useMemo(() => {
    if (results.length === 0) {
      return {
        averagePct: '0%',
        testsTaken: 0,
        bestSubject: '—',
      };
    }

    const totalPct = results.reduce((sum, r) => sum + r.percentage, 0);
    const avg = Math.round((totalPct / results.length) * 10) / 10;

    const bySubject = new Map<string, { sum: number; count: number }>();
    for (const r of results) {
      const prev = bySubject.get(r.subject) || { sum: 0, count: 0 };
      bySubject.set(r.subject, { sum: prev.sum + r.percentage, count: prev.count + 1 });
    }

    let bestSubject = results[0].subject;
    let bestAvg = -1;
    for (const [subj, stats] of bySubject.entries()) {
      const subjAvg = stats.sum / stats.count;
      if (subjAvg > bestAvg) {
        bestAvg = subjAvg;
        bestSubject = subj;
      }
    }

    return {
      averagePct: `${avg}%`,
      testsTaken: results.length,
      bestSubject,
    };
  }, [results]);

  const chartData: ChartPoint[] = useMemo(() => {
    const filtered =
      subjectFilter === 'All'
        ? results
        : results.filter((r) => r.subject === subjectFilter);

    return [...filtered].reverse().map((r) => ({
      testId: r.testId,
      label: formatShortDate(r.testDate),
      fullDate: formatFullDate(r.testDate),
      title: r.title,
      subject: r.subject,
      marksText: `${r.marksObtained} / ${r.totalMarks}`,
      percentage: r.percentage,
    }));
  }, [results, subjectFilter]);

  const recentTests = useMemo(() => results.slice(0, 3), [results]);

  const recentRemarks = useMemo(
    () => results.filter((r) => Boolean(r.remark && r.remark.trim())).slice(0, 3),
    [results],
  );

  async function handleViewPaper(item: StudentMarkWithTest) {
    if (!item.filePath) return;
    setOpeningTestId(item.testId);
    try {
      const signedUrl = await getPdfUrl(item.filePath);
      setPreviewFile({
        url: signedUrl,
        fileName: item.fileName || `${item.title}.pdf`,
        fileType: item.fileType,
        title: item.title,
      });
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Unable to open test paper.',
        'error',
      );
    } finally {
      setOpeningTestId(null);
    }
  }

  return (
    <div className="min-h-screen bg-[#F7F8FA] pb-24 overflow-x-hidden">
      {/* Slim Sticky Mobile-App Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80">
        <div className="w-full max-w-[640px] mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <BrandLogo size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-bold text-[#0F2A4A] truncate leading-tight">
                {student?.name || siteData.tuitionName}
              </p>
              <p className="text-xs text-slate-500 truncate leading-tight">
                {siteData.standard} Standard
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onLogout}
            aria-label="Logout"
            title="Logout"
            className="min-h-[44px] min-w-[44px] -mr-2 rounded-xl flex items-center justify-center text-slate-500 hover:text-[#0F2A4A] hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Single Centered App Column */}
      <main className="w-full max-w-[640px] mx-auto px-4 pt-4">
        {loading ? (
          <DashboardSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-white border border-red-200 shadow-sm p-6 text-center mt-6">
            <p className="text-sm font-semibold text-red-700">{error}</p>
            <button
              type="button"
              onClick={() => void loadDashboard()}
              className="mt-4 min-h-[44px] px-5 py-2 rounded-xl bg-[#0F2A4A] text-white text-sm font-semibold cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : !student ? null : (
          <>
            {tab === 'home' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {/* 1. Greeting Line */}
                <section aria-label="Greeting" className="pt-1">
                  <h1 className="text-xl font-bold text-[#0F2A4A] tracking-tight truncate">
                    Hello, {parent?.name || 'Parent'}
                  </h1>
                  <p className="text-sm text-slate-500 truncate">{student.name}</p>
                </section>

                {results.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-10 text-center">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-6 h-6" />
                    </div>
                    <h2 className="text-base font-bold text-[#0F2A4A]">No tests yet.</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Marks will appear here as soon as {siteData.tuitionName} records a test.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* 2. Latest Test Card */}
                    {latestTest && (
                      <section aria-label="Latest test result">
                        <div className="rounded-2xl bg-[#0F2A4A] text-white p-5 shadow-sm">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-[#F5A623]">
                                Latest Test · {latestTest.subject} ·{' '}
                                {formatFullDate(latestTest.testDate)}
                              </p>
                              <h2 className="mt-1.5 text-lg font-bold text-white leading-snug">
                                {latestTest.title}
                              </h2>
                              {latestTest.remark && (
                                <p className="mt-2 text-xs text-slate-300">
                                  Teacher note: {latestTest.remark}
                                </p>
                              )}
                            </div>

                            <div className="flex items-baseline gap-4 shrink-0">
                              <div className="sm:text-right">
                                <p className="text-xs text-slate-300">Score</p>
                                <p className="text-2xl font-bold font-mono-tabular text-white">
                                  {latestTest.marksObtained}
                                  <span className="text-sm font-medium text-slate-300">
                                    /{latestTest.totalMarks}
                                  </span>
                                </p>
                              </div>
                              <div className="h-9 w-px bg-white/15" aria-hidden="true" />
                              <div className="sm:text-right">
                                <p className="text-xs text-slate-300">Percentage</p>
                                <p className="text-2xl font-bold font-mono-tabular text-[#F5A623]">
                                  {latestTest.percentage}%
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {/* 3. Three Small Summary Cards in a Row */}
                    <section aria-label="Summary stats" className="grid grid-cols-3 gap-2.5 sm:gap-3">
                      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-3.5 min-w-0">
                        <p className="text-[11px] font-medium text-slate-500 truncate">
                          Average %
                        </p>
                        <p className="mt-1 text-lg sm:text-xl font-bold font-mono-tabular text-[#0F2A4A] truncate">
                          {summaryStats.averagePct}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-3.5 min-w-0">
                        <p className="text-[11px] font-medium text-slate-500 truncate">
                          Tests taken
                        </p>
                        <p className="mt-1 text-lg sm:text-xl font-bold font-mono-tabular text-[#0F2A4A] truncate">
                          {summaryStats.testsTaken}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-3.5 min-w-0">
                        <p className="text-[11px] font-medium text-slate-500 truncate">
                          Best subject
                        </p>
                        <p
                          title={summaryStats.bestSubject}
                          className="mt-1 text-sm sm:text-base font-bold text-[#0F2A4A] truncate leading-7"
                        >
                          {summaryStats.bestSubject}
                        </p>
                      </div>
                    </section>

                    {/* 4. Line Graph with Horizontally Scrollable Subject Filter Chips */}
                    <section className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 sm:p-5 min-w-0">
                      <div className="mb-3">
                        <h2 className="text-base font-bold text-[#0F2A4A]">
                          Score Progression
                        </h2>
                        <p className="text-xs text-slate-500">
                          Percentage across tests by date
                        </p>
                      </div>

                      <div
                        role="tablist"
                        aria-label="Filter marks by subject"
                        className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 mb-3"
                      >
                        {(['All', ...siteData.subjects] as const).map((subj) => {
                          const active = subjectFilter === subj;
                          return (
                            <button
                              key={subj}
                              type="button"
                              role="tab"
                              aria-selected={active}
                              onClick={() => setSubjectFilter(subj)}
                              className={`min-h-[44px] px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                                active
                                  ? 'bg-[#0F2A4A] text-white'
                                  : 'bg-[#F7F8FA] text-slate-600 hover:bg-slate-200/70 hover:text-[#0F2A4A]'
                              }`}
                            >
                              {subj}
                            </button>
                          );
                        })}
                      </div>

                      {chartData.length === 0 ? (
                        <div className="h-[220px] md:h-[300px] flex flex-col items-center justify-center text-center px-4 rounded-xl bg-[#F7F8FA]">
                          <p className="text-sm font-semibold text-[#0F2A4A]">
                            {subjectFilter === 'All'
                              ? 'No tests yet.'
                              : `No ${subjectFilter} tests yet.`}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            Results will plot here once graded.
                          </p>
                        </div>
                      ) : (
                        <div className="h-[220px] md:h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart
                              data={chartData}
                              margin={{ top: 10, right: 12, left: -16, bottom: 2 }}
                            >
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#E2E8F0"
                                vertical={false}
                              />
                              <XAxis
                                dataKey="label"
                                tick={{ fill: '#64748B', fontSize: 11 }}
                                axisLine={{ stroke: '#CBD5E1' }}
                                tickLine={false}
                              />
                              <YAxis
                                domain={[0, 100]}
                                ticks={[0, 25, 50, 75, 100]}
                                tickFormatter={(v) => `${v}%`}
                                tick={{ fill: '#64748B', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                              />
                              <Tooltip
                                content={({ active, payload }) => {
                                  if (!active || !payload || payload.length === 0) return null;
                                  const pt = payload[0].payload as ChartPoint;
                                  return (
                                    <div className="rounded-xl bg-[#0F2A4A] text-white px-3.5 py-2.5 shadow-lg text-xs max-w-[230px]">
                                      <p className="font-semibold text-[#F5A623]">
                                        {pt.subject} · {pt.fullDate}
                                      </p>
                                      <p className="mt-0.5 font-medium text-white leading-snug">
                                        {pt.title}
                                      </p>
                                      <p className="mt-1.5 font-mono-tabular text-slate-200">
                                        Marks: <strong>{pt.marksText}</strong> ({pt.percentage}%)
                                      </p>
                                    </div>
                                  );
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey="percentage"
                                stroke={siteData.brandColors.primary}
                                strokeWidth={2.5}
                                dot={{
                                  r: 4.5,
                                  fill: siteData.brandColors.accent,
                                  stroke: siteData.brandColors.primary,
                                  strokeWidth: 2,
                                }}
                                activeDot={{
                                  r: 6.5,
                                  fill: siteData.brandColors.accent,
                                  stroke: '#FFFFFF',
                                  strokeWidth: 2,
                                }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      )}
                    </section>

                    {/* 5. Recent Tests (Last 3) */}
                    <section aria-label="Recent tests" className="space-y-2.5">
                      <div className="flex items-center justify-between gap-2 px-0.5">
                        <h2 className="text-base font-bold text-[#0F2A4A]">Recent tests</h2>
                        {results.length > 3 && (
                          <button
                            type="button"
                            onClick={() => setTab('tests')}
                            className="min-h-[44px] px-2 text-xs font-semibold text-[#B47109] hover:underline cursor-pointer"
                          >
                            View all
                          </button>
                        )}
                      </div>

                      <div className="space-y-3">
                        {recentTests.map((item) => (
                          <TestResultCard
                            key={item.testId}
                            item={item}
                            opening={openingTestId === item.testId}
                            onViewPaper={() => void handleViewPaper(item)}
                          />
                        ))}
                      </div>
                    </section>

                    {/* 6. Teacher Remarks (Last 3 — hidden if none) */}
                    {recentRemarks.length > 0 && (
                      <section aria-label="Teacher remarks" className="space-y-2.5">
                        <h2 className="text-base font-bold text-[#0F2A4A] px-0.5">
                          Teacher remarks
                        </h2>
                        <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm divide-y divide-slate-100">
                          {recentRemarks.map((item) => (
                            <div key={item.markId} className="p-4 flex items-start gap-3">
                              <div className="w-8 h-8 rounded-xl bg-[#F5A623]/15 text-[#B47109] flex items-center justify-center shrink-0 mt-0.5">
                                <MessageSquareQuote className="w-4 h-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium text-[#0F2A4A] leading-snug">
                                  {item.remark}
                                </p>
                                <p className="mt-1 text-xs text-slate-500 truncate">
                                  {item.title} ·{' '}
                                  <span className="font-mono-tabular">
                                    {formatFullDate(item.testDate)}
                                  </span>
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </>
                )}

                {/* 7. Footer Text */}
                <footer className="pt-2 pb-4 text-center text-xs text-slate-400">
                  {siteData.tuitionName} · {siteData.standard} Standard
                </footer>
              </motion.div>
            )}

            {tab === 'tests' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between gap-4 pt-1">
                  <div>
                    <h1 className="text-xl font-bold text-[#0F2A4A]">All Tests</h1>
                    <p className="text-xs text-slate-500">Sorted newest first</p>
                  </div>
                  <span className="text-xs font-mono-tabular text-slate-500">
                    {results.length} {results.length === 1 ? 'test' : 'tests'}
                  </span>
                </div>

                {results.length === 0 ? (
                  <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-10 text-center">
                    <p className="text-sm font-semibold text-[#0F2A4A]">No tests yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {results.map((item) => (
                      <TestResultCard
                        key={item.testId}
                        item={item}
                        opening={openingTestId === item.testId}
                        onViewPaper={() => void handleViewPaper(item)}
                      />
                    ))}
                  </div>
                )}

                <footer className="pt-2 pb-4 text-center text-xs text-slate-400">
                  {siteData.tuitionName} · {siteData.standard} Standard
                </footer>
              </motion.div>
            )}

            {tab === 'profile' && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4 pt-1"
              >
                <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-5 sm:p-6">
                  <div className="flex items-center gap-3.5 pb-5 border-b border-slate-100">
                    <div className="w-12 h-12 rounded-2xl bg-[#0F2A4A] text-[#F5A623] font-bold text-lg flex items-center justify-center shrink-0">
                      {(parent?.name || student.name).charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h1 className="text-base font-bold text-[#0F2A4A] truncate">
                        {parent?.name || 'Parent'}
                      </h1>
                      <p className="text-xs text-slate-500 truncate">{parent?.email || ''}</p>
                    </div>
                  </div>

                  <dl className="mt-5 space-y-3.5 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Parent Name</dt>
                      <dd className="font-semibold text-[#0F2A4A] text-right truncate">
                        {parent?.name || '—'}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Student Name</dt>
                      <dd className="font-semibold text-[#0F2A4A] text-right truncate">
                        {student.name}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500">Standard</dt>
                      <dd className="font-semibold text-[#0F2A4A]">{student.standard}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                      <dt className="text-slate-500 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>Joining Date</span>
                      </dt>
                      <dd className="font-mono-tabular font-medium text-[#0F2A4A]">
                        {formatFullDate(student.joiningDate)}
                      </dd>
                    </div>
                    {parent?.phone && (
                      <div className="flex items-center justify-between gap-4">
                        <dt className="text-slate-500">Registered Phone</dt>
                        <dd className="font-mono-tabular font-medium text-[#0F2A4A]">
                          {parent.phone}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>

                <PWAInstallButton variant="card" />

                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full min-h-[48px] rounded-2xl border border-red-200 bg-white hover:bg-red-50 text-red-700 text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>

                <footer className="pt-2 pb-4 text-center text-xs text-slate-400">
                  {siteData.tuitionName} · {siteData.standard} Standard
                </footer>
              </motion.div>
            )}
          </>
        )}
      </main>

      {/* Fixed Bottom Tab Bar (All Screen Sizes) */}
      <nav
        aria-label="Parent navigation"
        className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe"
      >
        <div className="w-full max-w-[640px] mx-auto grid grid-cols-3 h-16 items-center">
          {(
            [
              { id: 'home', label: 'Home', Icon: Home },
              { id: 'tests', label: 'Tests', Icon: FileText },
              { id: 'profile', label: 'Profile', Icon: User },
            ] as const
          ).map(({ id, label, Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`min-h-[44px] flex flex-col items-center justify-center gap-0.5 transition-colors cursor-pointer ${
                  active
                    ? 'text-[#F5A623]'
                    : 'text-slate-400 hover:text-[#0F2A4A]'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span
                  className={`text-[11px] font-semibold tracking-tight ${
                    active ? 'text-[#0F2A4A]' : ''
                  }`}
                >
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

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

function TestResultCard({
  item,
  opening,
  onViewPaper,
}: {
  item: StudentMarkWithTest;
  opening: boolean;
  onViewPaper: () => void;
}) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200/80 shadow-sm p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 truncate">
            <span className="font-semibold text-[#0F2A4A]">{item.subject}</span>
            <span aria-hidden="true"> · </span>
            <span className="font-mono-tabular">{formatFullDate(item.testDate)}</span>
          </p>
          <h3 className="mt-1 text-sm sm:text-base font-bold text-[#0F2A4A] leading-snug">
            {item.title}
          </h3>
        </div>

        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-[#F5A623]/15 text-[#B47109] font-mono-tabular text-xs font-bold">
          {item.percentage}%
        </span>
      </div>

      {item.remark && (
        <p className="text-xs text-slate-500">Remark: {item.remark}</p>
      )}

      <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-100">
        <p className="font-mono-tabular text-sm font-bold text-[#0F2A4A]">
          {item.marksObtained} / {item.totalMarks}
          <span className="ml-1.5 text-xs font-normal text-slate-500">marks</span>
        </p>

        {item.filePath && (
          <button
            type="button"
            disabled={opening}
            onClick={onViewPaper}
            className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-[#F7F8FA] hover:bg-slate-100 text-xs font-semibold text-[#0F2A4A] transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{opening ? 'Opening...' : 'View Paper'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse pt-1">
      <div className="space-y-1.5">
        <div className="h-6 w-44 bg-slate-200 rounded-lg" />
        <div className="h-4 w-28 bg-slate-200/70 rounded" />
      </div>
      <div className="h-32 rounded-2xl bg-slate-200/80" />
      <div className="grid grid-cols-3 gap-2.5">
        <div className="h-20 rounded-2xl bg-white border border-slate-200" />
        <div className="h-20 rounded-2xl bg-white border border-slate-200" />
        <div className="h-20 rounded-2xl bg-white border border-slate-200" />
      </div>
      <div className="h-[280px] rounded-2xl bg-white border border-slate-200 p-4">
        <div className="h-4 w-36 bg-slate-200 rounded mb-4" />
        <div className="h-48 bg-slate-100 rounded-xl" />
      </div>
    </div>
  );
}
