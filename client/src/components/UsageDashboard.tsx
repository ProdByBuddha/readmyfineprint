import { useEffect, useMemo, useState } from 'react';
import { format, parseISO } from 'date-fns';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useOrganizations } from '@/hooks/useTeamManagement';
import { useOrgUsage } from '@/hooks/useUsageAnalytics';
import { motion } from 'framer-motion';
import {
  BarChart3,
  CalendarClock,
  FolderPlus,
  Loader2,
  MessageCircle,
  Share2,
} from 'lucide-react';

const LOOKBACK_OPTIONS = [7, 14, 30];

function formatNumber(value: number) {
  return value.toLocaleString();
}

export function UsageDashboard() {
  const { data: orgsData, isLoading: orgsLoading, error: orgsError } = useOrganizations();
  const organizations = orgsData?.organizations ?? [];
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [lookbackDays, setLookbackDays] = useState<number>(30);

  useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const orgId = selectedOrgId ?? undefined;
  const {
    data: usageData,
    error: usageError,
    isLoading: usageLoading,
    isRefetching: usageRefreshing,
  } = useOrgUsage(orgId, { days: lookbackDays });

  const dailyRecords = usageData?.usage ?? [];
  const totals = usageData?.totals ?? { tokensUsed: 0, analysesCount: 0, annotationsCount: 0, apiCallsCount: 0 };
  const period = usageData?.period;

  const activeDays = useMemo(
    () => dailyRecords.filter((record) => record.annotationsCount + record.apiCallsCount + record.analysesCount > 0).length,
    [dailyRecords],
  );

  const maxAnnotations = useMemo(
    () => Math.max(1, ...dailyRecords.map((record) => record.annotationsCount)),
    [dailyRecords],
  );
  const maxShares = useMemo(
    () => Math.max(1, ...dailyRecords.map((record) => record.apiCallsCount)),
    [dailyRecords],
  );
  const maxWorkspaces = useMemo(
    () => Math.max(1, ...dailyRecords.map((record) => record.analysesCount)),
    [dailyRecords],
  );

  const featureUnavailable = usageError?.message?.includes('not yet available');

  if (orgsLoading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (orgsError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Unable to load organizations</AlertTitle>
        <AlertDescription>{orgsError.message}</AlertDescription>
      </Alert>
    );
  }

  if (!orgsLoading && organizations.length === 0) {
    return (
      <Alert>
        <AlertTitle>No organizations available</AlertTitle>
        <AlertDescription>
          Create an organization to start tracking workspace and annotation adoption.
        </AlertDescription>
      </Alert>
    );
  }

  if (featureUnavailable) {
    return (
      <Alert>
        <AlertTitle>Usage analytics disabled</AlertTitle>
        <AlertDescription>
          Usage dashboards are not yet enabled for this environment.
        </AlertDescription>
      </Alert>
    );
  }

  if (usageError && !usageLoading) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Failed to load usage analytics</AlertTitle>
        <AlertDescription>{usageError.message}</AlertDescription>
      </Alert>
    );
  }

  const renderSummaryCards = () => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="bg-gradient-to-br from-sky-50 via-white to-white dark:from-sky-900/40 dark:via-slate-900/60 dark:to-slate-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Annotation activity</CardTitle>
            <p className="text-xs text-muted-foreground">
              Threads and comments created in the last {period?.days ?? lookbackDays} days
            </p>
          </div>
          <MessageCircle className="h-5 w-5 text-sky-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatNumber(totals.annotationsCount)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {period && period.days > 0
              ? `${formatNumber(Math.round((totals.annotationsCount / period.days) * 10) / 10)} per day`
              : '—'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-amber-50 via-white to-white dark:from-amber-900/40 dark:via-slate-900/60 dark:to-slate-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Documents shared</CardTitle>
            <p className="text-xs text-muted-foreground">
              Workspace document shares during the selected period
            </p>
          </div>
          <Share2 className="h-5 w-5 text-amber-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatNumber(totals.apiCallsCount)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {period && period.days > 0
              ? `${formatNumber(Math.round((totals.apiCallsCount / period.days) * 10) / 10)} per day`
              : '—'}
          </p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-emerald-50 via-white to-white dark:from-emerald-900/40 dark:via-slate-900/60 dark:to-slate-900">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle className="text-base font-semibold">Workspaces launched</CardTitle>
            <p className="text-xs text-muted-foreground">
              New workspaces created by your team
            </p>
          </div>
          <FolderPlus className="h-5 w-5 text-emerald-500" />
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatNumber(totals.analysesCount)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {period && period.days > 0
              ? `${formatNumber(Math.round((totals.analysesCount / period.days) * 10) / 10)} per day`
              : '—'}
          </p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-6">
      <Card className="border-0 shadow-xl bg-white/80 dark:bg-slate-900/60 backdrop-blur">
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl font-semibold">
                <BarChart3 className="h-5 w-5" /> Usage analytics
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Monitor how teams adopt workspaces and annotations across your organization.
              </p>
            </div>
            <Badge variant="secondary" className="flex items-center gap-1">
              <CalendarClock className="h-4 w-4" />
              {period ? `${format(parseISO(period.from), 'MMM d')} – ${format(parseISO(period.to), 'MMM d')}` : 'Last 30 days'}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="w-64">
              <Select
                value={selectedOrgId ?? undefined}
                onValueChange={(value) => setSelectedOrgId(value)}
              >
                <SelectTrigger className="bg-white/70 dark:bg-slate-900/60">
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              {LOOKBACK_OPTIONS.map((option) => (
                <Button
                  key={option}
                  variant={lookbackDays === option ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLookbackDays(option)}
                  className="rounded-full"
                  disabled={usageLoading && lookbackDays === option}
                >
                  Last {option}d
                </Button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {usageLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading usage metrics…
            </div>
          )}

          {renderSummaryCards()}

          <Card className="border shadow-sm bg-white/70 dark:bg-slate-950/40">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Daily breakdown</CardTitle>
              <p className="text-xs text-muted-foreground">
                {activeDays} active {activeDays === 1 ? 'day' : 'days'} in this window.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {dailyRecords.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-8 text-center text-sm text-muted-foreground">
                  No usage recorded yet for this organization.
                </div>
              ) : (
                <div className="space-y-4">
                  {dailyRecords.map((record) => {
                    const total = record.annotationsCount + record.apiCallsCount + record.analysesCount;
                    const isActive = total > 0;

                    return (
                      <motion.div
                        key={record.date}
                        layout
                        className="rounded-2xl border border-slate-200/70 dark:border-slate-800/70 bg-white/70 dark:bg-slate-950/40 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold">{format(parseISO(record.date), 'EEEE, MMM d')}</p>
                            <p className="text-xs text-muted-foreground">
                              {isActive ? 'Collaboration captured' : 'No events recorded'}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {isActive ? (
                              <Badge variant="outline" className="text-xs">
                                {total} events
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Idle day
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                              <span>Annotations</span>
                              <span>{record.annotationsCount}</span>
                            </div>
                            <Progress
                              value={Math.round((record.annotationsCount / maxAnnotations) * 100)}
                              className="h-2 mt-1"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                              <span>Documents shared</span>
                              <span>{record.apiCallsCount}</span>
                            </div>
                            <Progress
                              value={Math.round((record.apiCallsCount / maxShares) * 100)}
                              className="h-2 mt-1"
                            />
                          </div>
                          <div>
                            <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                              <span>Workspaces created</span>
                              <span>{record.analysesCount}</span>
                            </div>
                            <Progress
                              value={Math.round((record.analysesCount / maxWorkspaces) * 100)}
                              className="h-2 mt-1"
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </CardContent>
      </Card>

      {usageRefreshing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Refreshing metrics…
        </div>
      )}
    </div>
  );
}
