import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertCircle,
  Archive,
  Clock,
  Filter,
  FolderKanban,
  FolderPlus,
  Layers,
  Loader2,
  MessageCircle,
  MessageCirclePlus,
  Pencil,
  Share2,
  ShieldOff,
  Users,
  UserMinus,
  UserPlus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useOrganizations } from '@/hooks/useTeamManagement';
import { useWorkspaces } from '@/hooks/useWorkspaces';
import { useActivityEvents, useActivitySummary, ActivityEvent } from '@/hooks/useActivityFeed';
import { formatDistanceToNow } from 'date-fns';

interface ActionPresentation {
  icon: LucideIcon;
  label: string;
  tone: string;
}

const ACTION_PRESENTATION: Record<string, ActionPresentation> = {
  'workspace.created': { icon: FolderPlus, label: 'Workspace created', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200' },
  'workspace.updated': { icon: Pencil, label: 'Workspace updated', tone: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' },
  'workspace.archived': { icon: Archive, label: 'Workspace archived', tone: 'bg-slate-200 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200' },
  'workspace.member.added': { icon: UserPlus, label: 'Member added', tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-200' },
  'workspace.member.role_updated': { icon: Users, label: 'Member role updated', tone: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-200' },
  'workspace.member.removed': { icon: UserMinus, label: 'Member removed', tone: 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-200' },
  'workspace.document.shared': { icon: Share2, label: 'Document shared', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200' },
  'workspace.document.unshared': { icon: ShieldOff, label: 'Document unshared', tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-200' },
  'annotation.thread.created': { icon: MessageCirclePlus, label: 'Annotation thread created', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200' },
  'annotation.comment.created': { icon: MessageCirclePlus, label: 'Annotation comment added', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200' },
  'annotation.comment.updated': { icon: MessageCircle, label: 'Annotation comment edited', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200' },
  'annotation.comment.deleted': { icon: MessageCircle, label: 'Annotation comment removed', tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-200' },
  'annotation.comment.resolved': { icon: MessageCircle, label: 'Annotation comment resolved', tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-200' },
};

function describeEvent(event: ActivityEvent) {
  const metadata = event.metadata ?? {};
  const workspaceName = event.workspaceName ?? (typeof metadata.workspaceName === 'string' ? metadata.workspaceName : undefined);
  const actor = event.userEmail ?? 'System';
  const targetUserId = typeof metadata.targetUserId === 'string' ? metadata.targetUserId : undefined;
  const targetUserEmail = typeof metadata.targetUserEmail === 'string' ? metadata.targetUserEmail : undefined;
  const targetUser = targetUserEmail ?? targetUserId;
  const targetDocument = typeof metadata.documentId !== 'undefined'
    ? String(metadata.documentId)
    : typeof metadata.documentTitle === 'string'
      ? metadata.documentTitle
      : undefined;
  const threadId = typeof metadata.threadId === 'string' ? metadata.threadId : undefined;
  const commentId = typeof metadata.commentId === 'string' ? metadata.commentId : undefined;
  const changes =
    metadata && typeof metadata === 'object' && 'changes' in metadata && metadata.changes && typeof metadata.changes === 'object'
      ? Object.keys(metadata.changes as Record<string, unknown>)
      : undefined;

  const workspaceSuffix = workspaceName ? ` ${event.action.startsWith('workspace.document') ? 'to' : 'in'} ${workspaceName}` : '';
  const memberSuffix = workspaceName ? ` ${event.action === 'workspace.member.removed' ? 'from' : 'to'} ${workspaceName}` : '';
  const commentSuffix = commentId ? ` (#${commentId.slice(0, 8)})` : '';
  const threadSuffix = threadId ? ` (#${threadId.slice(0, 8)})` : '';

  switch (event.action) {
    case 'workspace.created':
      return `${actor} created ${workspaceName ?? 'a new workspace'}.`;
    case 'workspace.updated':
      return `${actor} updated workspace settings${workspaceName ? ` for ${workspaceName}` : ''}${changes && changes.length ? ` (${changes.join(', ')})` : ''}.`;
    case 'workspace.archived':
      return `${actor} archived ${workspaceName ?? 'a workspace'}.`;
    case 'workspace.member.added':
      return `${actor} added${targetUser ? ` ${targetUser}` : ''}${memberSuffix}.`;
    case 'workspace.member.role_updated':
      return `${actor} changed workspace roles${workspaceName ? ` in ${workspaceName}` : ''}.`;
    case 'workspace.member.removed':
      return `${actor} removed${targetUser ? ` ${targetUser}` : ''}${memberSuffix}.`;
    case 'workspace.document.shared':
      return `${actor} shared${targetDocument ? ` ${targetDocument}` : ' a document'}${workspaceSuffix}.`;
    case 'workspace.document.unshared':
      return `${actor} unshared${targetDocument ? ` ${targetDocument}` : ' a document'}${workspaceName ? ` from ${workspaceName}` : ''}.`;
    case 'annotation.thread.created':
      return `${actor} opened a new annotation thread${workspaceSuffix}${threadSuffix}.`;
    case 'annotation.comment.created':
      return `${actor} added an annotation comment${workspaceSuffix}${commentSuffix}.`;
    case 'annotation.comment.updated':
      return `${actor} edited an annotation comment${workspaceSuffix}${commentSuffix}.`;
    case 'annotation.comment.deleted':
      return `${actor} deleted an annotation comment${workspaceSuffix}${commentSuffix}.`;
    case 'annotation.comment.resolved':
      return `${actor} resolved an annotation${workspaceSuffix}.`;
    default:
      return `${actor} performed ${event.action}${workspaceName ? ` in ${workspaceName}` : ''}.`;
  }
}

function getSummaryCopy(action: string) {
  return ACTION_PRESENTATION[action]?.label ?? action;
}

function getActionPresentation(action: string): ActionPresentation {
  return ACTION_PRESENTATION[action] ?? {
    icon: Activity,
    label: action,
    tone: 'bg-slate-200 text-slate-700 dark:bg-slate-800/70 dark:text-slate-200',
  };
}

export function ActivityFeed() {
  const { data: orgsData, isLoading: orgsLoading, error: orgsError } = useOrganizations();
  const organizations = orgsData?.organizations ?? [];
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string>('all');
  const noOrganizations = !orgsLoading && !orgsError && organizations.length === 0;

  useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const orgId = selectedOrgId ?? undefined;

  const { data: workspacesData, isLoading: workspacesLoading } = useWorkspaces(orgId);
  const workspaceOptions = workspacesData?.workspaces ?? [];

  useEffect(() => {
    setSelectedWorkspaceId('all');
  }, [orgId]);

  const selectedWorkspaceFilter = selectedWorkspaceId === 'all' ? undefined : selectedWorkspaceId;

  const {
    data: eventsPages,
    error: eventsError,
    isLoading: eventsLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useActivityEvents(orgId, { workspaceId: selectedWorkspaceFilter, limit: 20 });

  const {
    data: summaryData,
    isLoading: summaryLoading,
    error: summaryError,
    refetch: refetchSummary,
  } = useActivitySummary(orgId, 7);

  const events = useMemo(
    () => eventsPages?.pages.flatMap((page) => page.events) ?? [],
    [eventsPages],
  );

  const featureDisabled = eventsError?.message?.toLowerCase().includes('not yet available') ?? false;

  return (
    <div className="space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Organization Activity
          </CardTitle>
          <CardDescription>
            Monitor collaboration health across workspaces and annotation threads.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {orgsError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {orgsError.message || 'Unable to load organizations'}
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Organization</p>
              <Select
                value={selectedOrgId ?? ''}
                onValueChange={(value) => setSelectedOrgId(value)}
                disabled={orgsLoading || noOrganizations}
              >
                <SelectTrigger>
                  <SelectValue placeholder={orgsLoading ? 'Loading...' : 'Select organization'} />
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

            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">Workspace filter</p>
              <Select
                value={selectedWorkspaceId}
                onValueChange={setSelectedWorkspaceId}
                disabled={workspacesLoading || !orgId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={workspacesLoading ? 'Loading...' : 'All workspaces'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All workspaces</SelectItem>
                  {workspaceOptions.map((workspace) => (
                    <SelectItem key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="col-span-1 bg-primary/5 dark:bg-primary/10 border-primary/20">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-primary flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Weekly Highlights
                </CardTitle>
                <CardDescription className="text-xs text-primary/80">
                  Top collaboration signals from the last 7 days.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {noOrganizations ? (
                  <p className="text-sm text-muted-foreground">
                    Join an organization to start tracking workspace and annotation trends.
                  </p>
                ) : summaryLoading || orgsLoading || (!orgId && !orgsError) ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                  </div>
                ) : summaryError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {summaryError.message || 'Unable to load summary'}
                    </AlertDescription>
                  </Alert>
                ) : summaryData && summaryData.length > 0 ? (
                  <ul className="space-y-3">
                    {summaryData
                      .slice()
                      .sort((a, b) => b.count - a.count)
                      .slice(0, 5)
                      .map((item) => {
                        const presentation = getActionPresentation(item.action);
                        return (
                          <li key={item.action} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-2 rounded-full text-xs ${presentation.tone}`}>
                                <presentation.icon className="h-4 w-4" />
                              </div>
                              <span className="text-sm font-medium">
                                {getSummaryCopy(item.action)}
                              </span>
                            </div>
                            <Badge variant="secondary" className="bg-white/60 dark:bg-slate-900/50">
                              {item.count}
                            </Badge>
                          </li>
                        );
                      })}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Activity data will appear once your team begins collaborating.
                  </p>
                )}
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      void refetchSummary();
                    }}
                    disabled={summaryLoading || noOrganizations || !orgId}
                  >
                    Refresh
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Latest events
                </CardTitle>
                <CardDescription>
                  Real-time audit trail across workspaces and annotations.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {noOrganizations ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      You are not a member of any organizations yet. Create or join one to see collaboration activity.
                    </AlertDescription>
                  </Alert>
                ) : orgsLoading || (!orgId && !orgsError) ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : featureDisabled ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      The activity feed is not yet available for your account. Reach out to support to enable the feature.
                    </AlertDescription>
                  </Alert>
                ) : eventsError ? (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {eventsError.message || 'Unable to load activity events'}
                    </AlertDescription>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      onClick={() => {
                        void refetch();
                      }}
                    >
                      Retry
                    </Button>
                  </Alert>
                ) : eventsLoading && events.length === 0 ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : events.length === 0 ? (
                  <div className="py-10 text-center">
                    <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground/60" />
                    <p className="mt-3 text-sm text-muted-foreground">
                      No activity yet. Actions across your workspaces will appear here instantly.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <ul className="space-y-3">
                      <AnimatePresence>
                        {events.map((event) => {
                          const presentation = getActionPresentation(event.action);
                          const Icon = presentation.icon;
                          const happenedAt = formatDistanceToNow(new Date(event.createdAt), { addSuffix: true });
                          return (
                            <motion.li
                              key={event.id}
                              layout
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="rounded-xl border border-slate-200 dark:border-slate-700/80 p-4"
                            >
                              <div className="flex items-start gap-4">
                                <div className={`p-3 rounded-full ${presentation.tone}`}>
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-semibold text-slate-900 dark:text-white">
                                      {presentation.label}
                                    </span>
                                    {event.workspaceName && (
                                      <Badge variant="secondary" className="bg-slate-100 dark:bg-slate-800 text-xs">
                                        {event.workspaceName}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-sm text-muted-foreground">
                                    {describeEvent(event)}
                                  </p>
                                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{happenedAt}</span>
                                    {event.userEmail && (
                                      <>
                                        <span>•</span>
                                        <span>{event.userEmail}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </motion.li>
                          );
                        })}
                      </AnimatePresence>
                    </ul>

                    {hasNextPage && (
                      <div className="flex justify-center">
                        <Button
                          variant="outline"
                          onClick={() => {
                            void fetchNextPage();
                          }}
                          disabled={isFetchingNextPage}
                        >
                          {isFetchingNextPage ? (
                            <span className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Loading...
                            </span>
                          ) : (
                            'Load more'
                          )}
                        </Button>
                      </div>
                    )}

                    <div className="flex justify-end text-xs text-muted-foreground">
                      {isRefetching ? 'Refreshing feed…' : 'Updated automatically every minute'}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
