import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  FolderPlus,
  Users,
  FileText,
  Settings,
  Trash2,
  Lock,
  Globe,
  Eye,
  Edit3,
  MessageCircle,
  Crown,
  Plus,
  X,
  Loader2,
  CheckCircle,
  Building2,
  Star,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useOrganizations } from '@/hooks/useTeamManagement';
import {
  useWorkspaces,
  useWorkspace,
  useCreateWorkspace,
  useUpdateWorkspace,
  useDeleteWorkspace,
  useWorkspaceMembers,
  useAddWorkspaceMember,
  useUpdateWorkspaceMemberRole,
  useRemoveWorkspaceMember,
  useWorkspaceDocuments,
  useShareDocument,
  useUnshareDocument,
  type Workspace,
  type WorkspaceMember,
} from '@/hooks/useWorkspaces';

// Role color schemes
const roleColors = {
  owner: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  editor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  commenter: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
};

const roleIcons = {
  owner: Crown,
  editor: Edit3,
  commenter: MessageCircle,
  viewer: Eye
};

const roleDescriptions = {
  owner: 'Full control over workspace settings and members',
  editor: 'Can edit content and share documents',
  commenter: 'Can add comments and annotations',
  viewer: 'Read-only access to workspace'
};

// Create Workspace Dialog Component
function CreateWorkspaceDialog({ 
  orgId, 
  isOpen, 
  onClose 
}: { 
  orgId: string; 
  isOpen: boolean; 
  onClose: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'org' | 'private'>('org');
  const [isDefault, setIsDefault] = useState(false);

  const createWorkspace = useCreateWorkspace(orgId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({
        title: 'Error',
        description: 'Workspace name is required',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createWorkspace.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        isDefault,
      });

      toast({
        title: 'Success',
        description: 'Workspace created successfully',
      });

      setName('');
      setDescription('');
      setVisibility('org');
      setIsDefault(false);
      onClose();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create workspace',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Workspace</DialogTitle>
          <DialogDescription>
            Create a new workspace to organize and share documents with your team.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Workspace Name *</Label>
            <Input
              id="name"
              placeholder="Engineering Team"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={createWorkspace.isPending}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="A workspace for engineering team collaboration..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={createWorkspace.isPending}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Visibility</Label>
            <Select
              value={visibility}
              onValueChange={(value: 'org' | 'private') => setVisibility(value)}
              disabled={createWorkspace.isPending}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Organization</div>
                      <div className="text-xs text-muted-foreground">
                        All org members can view
                      </div>
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="private">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4" />
                    <div>
                      <div className="font-medium">Private</div>
                      <div className="text-xs text-muted-foreground">
                        Only members can access
                      </div>
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
              disabled={createWorkspace.isPending}
            />
            <Label htmlFor="default" className="cursor-pointer">
              Set as default workspace
            </Label>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={createWorkspace.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createWorkspace.isPending}>
              {createWorkspace.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create Workspace
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Workspace Card Component
function WorkspaceCard({ 
  workspace, 
  onSelect,
  isSelected 
}: { 
  workspace: Workspace;
  onSelect: () => void;
  isSelected: boolean;
}) {
  const VisibilityIcon = workspace.visibility === 'org' ? Globe : Lock;
  const RoleIcon = workspace.role ? roleIcons[workspace.role] : Eye;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={`cursor-pointer transition-all hover:shadow-md ${
          isSelected 
            ? 'border-2 border-primary ring-2 ring-primary/20' 
            : 'border hover:border-primary/50'
        }`}
        onClick={onSelect}
      >
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Folder className="h-5 w-5" />
                {workspace.name}
                {workspace.isDefault && (
                  <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                )}
              </CardTitle>
              {workspace.description && (
                <CardDescription className="mt-1 line-clamp-2">
                  {workspace.description}
                </CardDescription>
              )}
            </div>
            {isSelected && (
              <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{workspace.memberCount}</span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  <span>{workspace.documentCount}</span>
                </div>
              </div>
              <VisibilityIcon className="h-4 w-4 text-muted-foreground" />
            </div>

            {workspace.role && (
              <Badge className={roleColors[workspace.role]} variant="secondary">
                <RoleIcon className="mr-1 h-3 w-3" />
                {workspace.role}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// Main Workspace Management Component
export function WorkspaceManagement() {
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  // Fetch organizations
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const organizations = orgsData?.organizations || [];

  // Auto-select first org if none selected
  if (!selectedOrgId && organizations.length > 0 && !orgsLoading) {
    setSelectedOrgId(organizations[0].id);
  }

  // Fetch workspaces for selected org
  const { data: workspacesData, isLoading: workspacesLoading } = useWorkspaces(selectedOrgId || undefined);
  const workspaces = workspacesData?.workspaces || [];

  // Auto-select first workspace if none selected
  if (!selectedWorkspaceId && workspaces.length > 0 && !workspacesLoading) {
    setSelectedWorkspaceId(workspaces[0].id);
  }

  // Fetch selected workspace details
  const { data: workspaceData } = useWorkspace(selectedWorkspaceId || undefined);
  const selectedWorkspace = workspaceData?.workspace;

  // Fetch workspace members
  const { data: membersData, isLoading: membersLoading } = useWorkspaceMembers(
    selectedWorkspaceId || undefined
  );
  const members = membersData?.members || [];

  // Fetch workspace documents
  const { data: documentsData, isLoading: documentsLoading } = useWorkspaceDocuments(
    selectedWorkspaceId || undefined
  );
  const documents = documentsData?.documents || [];

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);
  const canManageWorkspaces = selectedOrg?.role === 'admin' || selectedOrg?.role === 'member';
  const isWorkspaceOwner = selectedWorkspace?.role === 'owner';

  return (
    <div className="space-y-6">
      {/* Organization Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Organization</span>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orgsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : organizations.length === 0 ? (
            <Alert>
              <Building2 className="h-4 w-4" />
              <AlertDescription>
                You're not part of any organization yet.
              </AlertDescription>
            </Alert>
          ) : (
            <Select value={selectedOrgId || ''} onValueChange={setSelectedOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <div className="flex items-center justify-between gap-4">
                      <span>{org.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {org.memberCount} members
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {selectedOrgId && (
        <>
          {/* Workspaces Grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Folder className="h-5 w-5" />
                  <span>Workspaces</span>
                </div>
                {canManageWorkspaces && (
                  <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Create Workspace
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {workspacesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : workspaces.length === 0 ? (
                <Alert>
                  <Folder className="h-4 w-4" />
                  <AlertDescription>
                    No workspaces yet. Create one to get started!
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  <AnimatePresence>
                    {workspaces.map((workspace) => (
                      <WorkspaceCard
                        key={workspace.id}
                        workspace={workspace}
                        onSelect={() => setSelectedWorkspaceId(workspace.id)}
                        isSelected={selectedWorkspaceId === workspace.id}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Selected Workspace Details */}
          {selectedWorkspaceId && selectedWorkspace && (
            <Card>
              <CardHeader>
                <CardTitle>Workspace Details</CardTitle>
                <CardDescription>
                  {selectedWorkspace.name} • {selectedWorkspace.memberCount} members • {selectedWorkspace.documentCount} documents
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Members Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Members ({members.length})
                    </h3>
                    {isWorkspaceOwner && (
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Add Member
                      </Button>
                    )}
                  </div>

                  {membersLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : members.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No members yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {members.map((member) => {
                        const RoleIcon = roleIcons[member.role];
                        return (
                          <div
                            key={member.userId}
                            className="flex items-center justify-between p-3 rounded-lg border"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10">
                                <Users className="h-4 w-4 text-primary" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{member.email}</p>
                                <Badge className={`${roleColors[member.role]} text-xs mt-1`} variant="secondary">
                                  <RoleIcon className="mr-1 h-3 w-3" />
                                  {member.role}
                                </Badge>
                              </div>
                            </div>
                            {member.emailVerified && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Documents Section */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Shared Documents ({documents.length})
                    </h3>
                    {(selectedWorkspace.role === 'owner' || selectedWorkspace.role === 'editor') && (
                      <Button size="sm" variant="outline">
                        <Plus className="h-4 w-4 mr-2" />
                        Share Document
                      </Button>
                    )}
                  </div>

                  {documentsLoading ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents shared yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div
                          key={doc.documentId}
                          className="flex items-center justify-between p-3 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <FileText className="h-5 w-5 text-muted-foreground" />
                            <div>
                              <p className="text-sm font-medium">Document #{doc.documentId}</p>
                              <p className="text-xs text-muted-foreground">
                                Added {new Date(doc.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Create Workspace Dialog */}
      {selectedOrgId && (
        <CreateWorkspaceDialog
          orgId={selectedOrgId}
          isOpen={showCreateDialog}
          onClose={() => setShowCreateDialog(false)}
        />
      )}
    </div>
  );
}
