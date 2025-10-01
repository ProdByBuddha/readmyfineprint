import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  FileText,
  MessageCircle,
  MessageCirclePlus,
  RefreshCw,
  Users,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { useOrganizations } from '@/hooks/useTeamManagement';
import { useWorkspaces, useWorkspaceDocuments } from '@/hooks/useWorkspaces';
import {
  useAnnotationThreads,
  useAnnotationThread,
  useCreateAnnotationThread,
  useAddAnnotationComment,
  useUpdateAnnotationComment,
  useDeleteAnnotationComment,
  useToggleThreadResolution,
  AnnotationThreadSummary,
  AnnotationCommentRecord,
} from '@/hooks/useAnnotations';

function formatDate(date: string | null | undefined) {
  if (!date) return '—';
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch (error) {
    console.error('Failed to format annotation date', error);
    return '—';
  }
}

function summarizeThread(thread: AnnotationThreadSummary) {
  const preview = thread.anchor.length > 90 ? `${thread.anchor.slice(0, 90)}…` : thread.anchor;
  return preview || `Thread #${thread.id.slice(0, 8)}`;
}

function commentPreview(comment: AnnotationCommentRecord) {
  const body = comment.body.trim();
  if (!body) return 'Empty comment';
  return body.length > 120 ? `${body.slice(0, 120)}…` : body;
}

export function AnnotationsPanel() {
  const { toast } = useToast();
  const { data: orgData, isLoading: orgsLoading, error: orgsError } = useOrganizations();
  const organizations = orgData?.organizations ?? [];
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>('all');
  const [includeResolved, setIncludeResolved] = useState<boolean>(false);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [anchorInput, setAnchorInput] = useState('');
  const [initialCommentInput, setInitialCommentInput] = useState('');
  const [newComment, setNewComment] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState('');

  useEffect(() => {
    if (!selectedOrgId && organizations.length > 0) {
      setSelectedOrgId(organizations[0].id);
    }
  }, [organizations, selectedOrgId]);

  const orgId = selectedOrgId ?? undefined;
  const { data: workspaceData, isLoading: workspacesLoading, error: workspacesError } = useWorkspaces(orgId);
  const workspaces = workspaceData?.workspaces ?? [];

  useEffect(() => {
    if (workspaces.length === 0) {
      setSelectedWorkspaceId(null);
      return;
    }

    if (!selectedWorkspaceId || !workspaces.some((w) => w.id === selectedWorkspaceId)) {
      setSelectedWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, selectedWorkspaceId]);

  useEffect(() => {
    setSelectedDocumentId('all');
    setSelectedThreadId(null);
  }, [selectedWorkspaceId]);

  const workspaceId = selectedWorkspaceId ?? undefined;
  const { data: documentsData, isLoading: documentsLoading, error: documentsError } = useWorkspaceDocuments(workspaceId);
  const documents = documentsData?.documents ?? [];

  const documentIdFilter = selectedDocumentId === 'all' ? undefined : Number(selectedDocumentId);

  const {
    data: threadsPages,
    isLoading: threadsLoading,
    error: threadsError,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch: refetchThreads,
    isRefetching: threadsRefetching,
  } = useAnnotationThreads(workspaceId, {
    documentId: documentIdFilter,
    includeResolved,
    limit: 20,
  });

  const threads = useMemo(
    () => threadsPages?.pages.flatMap((page) => page.threads) ?? [],
    [threadsPages]
  );

  useEffect(() => {
    if (!selectedThreadId && threads.length > 0) {
      setSelectedThreadId(threads[0].id);
    } else if (selectedThreadId && !threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads.length ? threads[0].id : null);
    }
  }, [threads, selectedThreadId]);

  const {
    data: threadDetail,
    isLoading: threadLoading,
    error: threadError,
  } = useAnnotationThread(workspaceId, selectedThreadId ?? undefined);

  const createThread = useCreateAnnotationThread(workspaceId);
  const addComment = useAddAnnotationComment(workspaceId, selectedThreadId ?? undefined);
  const updateComment = useUpdateAnnotationComment(workspaceId, selectedThreadId ?? undefined);
  const deleteComment = useDeleteAnnotationComment(workspaceId, selectedThreadId ?? undefined);
  const toggleResolution = useToggleThreadResolution(workspaceId, selectedThreadId ?? undefined);

  const noOrganizations = !orgsLoading && !orgsError && organizations.length === 0;
  const featureUnavailable =
    threadsError instanceof Error && threadsError.message === 'Annotations feature is not yet available';

  const handleCreateThread = () => {
    if (!workspaceId || !documentIdFilter) {
      toast({
        title: 'Select a document',
        description: 'Choose a document shared with this workspace before creating annotations.',
        variant: 'destructive',
      });
      return;
    }

    if (!anchorInput.trim()) {
      toast({
        title: 'Anchor required',
        description: 'Provide the document selection or anchor that the thread is referencing.',
        variant: 'destructive',
      });
      return;
    }

    createThread.mutate(
      {
        documentId: documentIdFilter,
        anchor: anchorInput.trim(),
        initialComment: initialCommentInput.trim() || undefined,
      },
      {
        onSuccess: (detail) => {
          setAnchorInput('');
          setInitialCommentInput('');
          setSelectedThreadId(detail.thread.id);
          toast({
            title: 'Annotation thread created',
            description: 'The thread is now available for collaboration.',
          });
        },
        onError: (error) => {
          toast({
            title: 'Unable to create thread',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleAddComment = () => {
    if (!newComment.trim()) {
      toast({
        title: 'Comment required',
        description: 'Write a comment before submitting.',
        variant: 'destructive',
      });
      return;
    }

    addComment.mutate(
      { body: newComment.trim() },
      {
        onSuccess: () => {
          setNewComment('');
          toast({
            title: 'Comment added',
            description: 'Your annotation comment is live.',
          });
        },
        onError: (error) => {
          toast({
            title: 'Unable to add comment',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleUpdateComment = () => {
    if (!editingCommentId) return;
    if (!editingBody.trim()) {
      toast({
        title: 'Comment required',
        description: 'Provide content before saving your edits.',
        variant: 'destructive',
      });
      return;
    }

    updateComment.mutate(
      { commentId: editingCommentId, body: editingBody.trim() },
      {
        onSuccess: () => {
          setEditingCommentId(null);
          setEditingBody('');
          toast({
            title: 'Comment updated',
            description: 'Your changes were saved.',
          });
        },
        onError: (error) => {
          toast({
            title: 'Unable to update comment',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleDeleteComment = (commentId: string) => {
    deleteComment.mutate(
      { commentId },
      {
        onSuccess: () => {
          toast({
            title: 'Comment removed',
            description: 'The annotation comment has been deleted.',
          });
        },
        onError: (error) => {
          toast({
            title: 'Unable to delete comment',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const handleToggleResolution = () => {
    if (!threadDetail) return;
    toggleResolution.mutate(
      { resolved: !threadDetail.thread.isResolved },
      {
        onSuccess: () => {
          toast({
            title: threadDetail.thread.isResolved ? 'Thread reopened' : 'Thread resolved',
            description: threadDetail.thread.isResolved
              ? 'The annotation thread is active again.'
              : 'The annotation thread has been marked as resolved.',
          });
        },
        onError: (error) => {
          toast({
            title: 'Unable to update thread',
            description: error.message,
            variant: 'destructive',
          });
        },
      }
    );
  };

  const isLoading =
    orgsLoading ||
    workspacesLoading ||
    documentsLoading ||
    threadsLoading ||
    threadLoading;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="bg-white/80 dark:bg-slate-900/60 backdrop-blur-sm shadow-xl border-slate-200 dark:border-slate-800">
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2 text-xl font-semibold">
              <MessageCircle className="h-5 w-5 text-primary" />
              Workspace Annotations
            </CardTitle>
            <CardDescription className="text-sm text-slate-600 dark:text-slate-400">
              Review collaborative annotation threads across workspaces, add comments, and resolve feedback when it’s addressed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {featureUnavailable ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  The annotations feature isn’t enabled for your account yet. Contact support to request access.
                </AlertDescription>
              </Alert>
            ) : noOrganizations ? (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Create an organization to start annotating documents with your team.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
                <div className="space-y-6">
                  <div className="space-y-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 p-4 shadow-sm">
                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Organization</Label>
                      <Select value={selectedOrgId ?? ''} onValueChange={(value) => setSelectedOrgId(value)} disabled={orgsLoading}>
                        <SelectTrigger className="bg-white dark:bg-slate-900">
                          <SelectValue placeholder="Select an organization" />
                        </SelectTrigger>
                        <SelectContent>
                          {organizations.map((org) => (
                            <SelectItem key={org.id} value={org.id}>
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-primary" />
                                <span>{org.name}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Workspace</Label>
                      <Select
                        value={selectedWorkspaceId ?? ''}
                        onValueChange={(value) => setSelectedWorkspaceId(value)}
                        disabled={workspacesLoading || workspaces.length === 0}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900">
                          <SelectValue placeholder="Select a workspace" />
                        </SelectTrigger>
                        <SelectContent>
                          {workspaces.map((workspace) => (
                            <SelectItem key={workspace.id} value={workspace.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{workspace.name}</span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {workspace.visibility === 'private' ? 'Private workspace' : 'Organization workspace'}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Document</Label>
                      <Select
                        value={selectedDocumentId}
                        onValueChange={(value) => setSelectedDocumentId(value)}
                        disabled={documentsLoading || documents.length === 0}
                      >
                        <SelectTrigger className="bg-white dark:bg-slate-900">
                          <SelectValue placeholder="Select a document" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All documents</SelectItem>
                          {documents.map((document) => (
                            <SelectItem key={document.documentId} value={String(document.documentId)}>
                              <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-primary" />
                                <span>Document #{document.documentId}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between rounded-lg bg-slate-100/70 dark:bg-slate-800/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Include resolved threads</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Toggle to review previously resolved feedback alongside active threads.
                        </p>
                      </div>
                      <Switch checked={includeResolved} onCheckedChange={setIncludeResolved} />
                    </div>

                    <div className="space-y-3">
                      <Label className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        New thread anchor
                      </Label>
                      <Input
                        value={anchorInput}
                        onChange={(event) => setAnchorInput(event.target.value)}
                        placeholder="Highlight, clause, or selection"
                        disabled={!workspaceId || !documentIdFilter || createThread.isPending}
                      />
                      <Textarea
                        value={initialCommentInput}
                        onChange={(event) => setInitialCommentInput(event.target.value)}
                        placeholder="Add optional context for teammates"
                        className="min-h-[100px]"
                        disabled={!workspaceId || !documentIdFilter || createThread.isPending}
                      />
                      <Button
                        onClick={handleCreateThread}
                        disabled={
                          !workspaceId ||
                          !documentIdFilter ||
                          !anchorInput.trim() ||
                          createThread.isPending
                        }
                        className="w-full"
                      >
                        {createThread.isPending ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <MessageCirclePlus className="h-4 w-4" />
                            <span>Start thread</span>
                          </>
                        )}
                      </Button>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Choose a document to enable thread creation. Threads capture the anchor text and kickoff comment.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-slate-600 dark:text-slate-300">Threads</h3>
                      <Button variant="ghost" size="sm" onClick={() => refetchThreads()} disabled={threadsRefetching}>
                        <RefreshCw className={`h-4 w-4 ${threadsRefetching ? 'animate-spin' : ''}`} />
                      </Button>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/50 shadow-sm">
                      {threadsLoading && (
                        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Loading threads…</div>
                      )}

                      {!threadsLoading && threads.length === 0 && (
                        <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                          {documents.length === 0
                            ? 'Share a document with this workspace to start annotating.'
                            : 'No annotation threads yet. Create one to capture document feedback.'}
                        </div>
                      )}

                      <AnimatePresence initial={false}>
                        {threads.map((thread) => (
                          <motion.button
                            type="button"
                            key={thread.id}
                            onClick={() => setSelectedThreadId(thread.id)}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className={`w-full text-left px-4 py-3 transition hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                              selectedThreadId === thread.id
                                ? 'bg-primary/10 dark:bg-primary/20'
                                : ''
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                  {summarizeThread(thread)}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                  Document #{thread.documentId} • {thread.commentCount} comment{thread.commentCount === 1 ? '' : 's'}
                                </p>
                              </div>
                              <Badge variant={thread.isResolved ? 'outline' : 'secondary'}>
                                {thread.isResolved ? 'Resolved' : 'Active'}
                              </Badge>
                            </div>
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              Updated {formatDate(thread.lastActivityAt)}
                            </p>
                          </motion.button>
                        ))}
                      </AnimatePresence>

                      {hasNextPage && (
                        <div className="p-4">
                          <Button
                            variant="secondary"
                            className="w-full"
                            onClick={() => fetchNextPage()}
                            disabled={isFetchingNextPage}
                          >
                            {isFetchingNextPage ? 'Loading more…' : 'Load more threads'}
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 shadow-inner flex flex-col">
                  <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-700 dark:text-slate-200">Thread details</h3>
                      {threadDetail?.thread && (
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Anchor recorded by {threadDetail.thread.createdByEmail || 'Unknown user'} •{' '}
                          {formatDate(threadDetail.thread.createdAt)}
                        </p>
                      )}
                    </div>
                    {threadDetail?.thread && (
                      <Badge variant={threadDetail.thread.isResolved ? 'outline' : 'secondary'}>
                        {threadDetail.thread.isResolved ? 'Resolved' : 'Active'}
                      </Badge>
                    )}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    {threadError && (
                      <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Failed to load the selected thread. {threadError.message}
                      </div>
                    )}

                    {!threadError && !threadDetail && !threadLoading && (
                      <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">
                        Select a thread to view annotation comments and resolution history.
                      </div>
                    )}

                    {threadLoading && (
                      <div className="p-8 text-center text-sm text-slate-500 dark:text-slate-400">Loading thread…</div>
                    )}

                    {threadDetail && !threadLoading && (
                      <div className="flex h-full flex-col">
                        <div className="px-6 py-4 space-y-3 border-b border-slate-200 dark:border-slate-800">
                          <div className="flex items-start gap-2">
                            <MessageCircle className="mt-1 h-4 w-4 text-primary" />
                            <div>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Anchor</p>
                              <p className="text-sm text-slate-600 dark:text-slate-300">{threadDetail.thread.anchor}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <FileText className="mt-1 h-4 w-4 text-primary" />
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              Document #{threadDetail.thread.documentId}
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckCircle2 className="mt-1 h-4 w-4 text-primary" />
                            <div className="text-sm text-slate-600 dark:text-slate-300">
                              {threadDetail.thread.isResolved
                                ? `Resolved ${formatDate(threadDetail.thread.resolvedAt)}`
                                : 'Awaiting resolution'}
                            </div>
                          </div>
                          <Button
                            variant={threadDetail.thread.isResolved ? 'secondary' : 'default'}
                            size="sm"
                            onClick={handleToggleResolution}
                            disabled={toggleResolution.isPending}
                          >
                            {toggleResolution.isPending ? (
                              <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : threadDetail.thread.isResolved ? (
                              'Reopen thread'
                            ) : (
                              'Resolve thread'
                            )}
                          </Button>
                        </div>

                        <ScrollArea className="flex-1 px-6">
                          <div className="space-y-4 py-6">
                            {threadDetail.comments.length === 0 ? (
                              <p className="text-sm text-slate-500 dark:text-slate-400 text-center">
                                No comments yet. Use the composer below to leave feedback.
                              </p>
                            ) : (
                              threadDetail.comments.map((comment) => (
                                <div
                                  key={comment.id}
                                  className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/70 p-4 shadow-sm"
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div>
                                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                        {comment.userEmail || 'Unknown user'}
                                      </p>
                                      <p className="text-xs text-slate-500 dark:text-slate-400">
                                        Posted {formatDate(comment.createdAt)}
                                        {comment.editedAt ? ` • Edited ${formatDate(comment.editedAt)}` : ''}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          setEditingCommentId(comment.id);
                                          setEditingBody(comment.body);
                                        }}
                                      >
                                        Edit
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="text-rose-600 hover:text-rose-500"
                                        onClick={() => handleDeleteComment(comment.id)}
                                        disabled={deleteComment.isPending}
                                      >
                                        Delete
                                      </Button>
                                    </div>
                                  </div>
                                  {editingCommentId === comment.id ? (
                                    <div className="mt-3 space-y-3">
                                      <Textarea
                                        value={editingBody}
                                        onChange={(event) => setEditingBody(event.target.value)}
                                        className="min-h-[120px]"
                                      />
                                      <div className="flex items-center gap-2">
                                        <Button size="sm" onClick={handleUpdateComment} disabled={updateComment.isPending}>
                                          {updateComment.isPending ? 'Saving…' : 'Save changes'}
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="secondary"
                                          onClick={() => {
                                            setEditingCommentId(null);
                                            setEditingBody('');
                                          }}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                                      {commentPreview(comment)}
                                    </p>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>

                        <div className="border-t border-slate-200 dark:border-slate-800 px-6 py-4 space-y-3">
                          <Label className="text-sm font-semibold text-slate-600 dark:text-slate-300">Add a comment</Label>
                          <Textarea
                            value={newComment}
                            onChange={(event) => setNewComment(event.target.value)}
                            placeholder="Share context, ask questions, or confirm completion"
                            className="min-h-[120px]"
                            disabled={addComment.isPending}
                          />
                          <Button onClick={handleAddComment} disabled={addComment.isPending || !newComment.trim()}>
                            {addComment.isPending ? 'Posting…' : 'Post comment'}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {(orgsError || workspacesError || documentsError || threadsError) && !featureUnavailable && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {orgsError?.message ||
                    workspacesError?.message ||
                    documentsError?.message ||
                    threadsError?.message ||
                    'Something went wrong while loading annotations.'}
                </AlertDescription>
              </Alert>
            )}

            {isLoading && (
              <div className="text-xs text-slate-500 dark:text-slate-400">Fetching annotation workspace data…</div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
