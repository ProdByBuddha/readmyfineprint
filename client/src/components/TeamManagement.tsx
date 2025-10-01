import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Calendar,
  Trash2,
  X,
  Send,
  Loader2,
  Building2,
  Crown,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
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
import { useToast } from '@/hooks/use-toast';
import {
  useOrganizations,
  useOrganizationMembers,
  useInvitations,
  useCreateInvitation,
  useRevokeInvitation,
  useUpdateMemberRole,
  useRemoveMember,
  useCreateOrganization,
} from '@/hooks/useTeamManagement';

const roleColors = {
  admin: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  member: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  viewer: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
};

const roleIcons = {
  admin: Crown,
  member: Users,
  viewer: Eye
};

const roleDescriptions = {
  admin: 'Full access to manage organization and members',
  member: 'Can collaborate and contribute to workspaces',
  viewer: 'Read-only access to organization content'
};

export function TeamManagement() {
  const { toast } = useToast();
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [showCreateOrg, setShowCreateOrg] = useState(false);

  // Fetch organizations
  const { data: orgsData, isLoading: orgsLoading } = useOrganizations();
  const organizations = orgsData?.organizations || [];

  // Auto-select first org if none selected
  if (!selectedOrgId && organizations.length > 0 && !orgsLoading) {
    setSelectedOrgId(organizations[0].id);
  }

  const selectedOrg = organizations.find(org => org.id === selectedOrgId);
  const isAdmin = selectedOrg?.role === 'admin';

  return (
    <div className="space-y-6">
      {/* Organization Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5" />
              <span>Your Organizations</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCreateOrg(true)}
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {orgsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : organizations.length === 0 ? (
            <Alert>
              <Building2 className="h-4 w-4" />
              <AlertDescription>
                You're not part of any organization yet. Create one to get started!
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-3">
              {organizations.map((org) => (
                <motion.div
                  key={org.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                    selectedOrgId === org.id
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedOrgId(org.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{org.name}</h4>
                        <Badge className={roleColors[org.role]} variant="secondary">
                          {org.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
                      </p>
                    </div>
                    {selectedOrgId === org.id && (
                      <CheckCircle className="h-5 w-5 text-primary" />
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Management Content */}
      {selectedOrgId && (
        <>
          {/* Invite Members Section */}
          {isAdmin && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <UserPlus className="h-5 w-5" />
                    <span>Invite Members</span>
                  </div>
                  {!showInviteForm && (
                    <Button onClick={() => setShowInviteForm(true)} size="sm">
                      <Send className="h-4 w-4 mr-2" />
                      New Invitation
                    </Button>
                  )}
                </CardTitle>
                <CardDescription>
                  Invite team members to collaborate in your organization
                </CardDescription>
              </CardHeader>
              {showInviteForm && (
                <CardContent>
                  <InviteForm
                    orgId={selectedOrgId}
                    onSuccess={() => {
                      setShowInviteForm(false);
                      toast({
                        title: "Invitation sent!",
                        description: "The user will receive an email invitation.",
                      });
                    }}
                    onCancel={() => setShowInviteForm(false)}
                  />
                </CardContent>
              )}
            </Card>
          )}

          {/* Pending Invitations */}
          <InvitationsList orgId={selectedOrgId} isAdmin={isAdmin} />

          {/* Current Members */}
          <MembersList orgId={selectedOrgId} isAdmin={isAdmin} />
        </>
      )}

      {/* Create Organization Dialog */}
      <CreateOrganizationDialog
        open={showCreateOrg}
        onClose={() => setShowCreateOrg(false)}
        onSuccess={(orgId) => {
          setShowCreateOrg(false);
          setSelectedOrgId(orgId);
        }}
      />
    </div>
  );
}

// Invite Form Component
function InviteForm({
  orgId,
  onSuccess,
  onCancel
}: {
  orgId: string;
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member' | 'viewer'>('member');
  const createInvitation = useCreateInvitation(orgId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address",
        variant: "destructive"
      });
      return;
    }

    try {
      await createInvitation.mutateAsync({ email, role });
      setEmail('');
      setRole('member');
      onSuccess();
    } catch (error) {
      toast({
        title: "Failed to send invitation",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label htmlFor="invite-email">Email Address</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="colleague@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="mt-1"
          />
        </div>
        <div>
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={(val: any) => setRole(val)}>
            <SelectTrigger className="mt-1" id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(['admin', 'member', 'viewer'] as const).map((r) => {
                const Icon = roleIcons[r];
                return (
                  <SelectItem key={r} value={r}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4" />
                      <span className="capitalize">{r}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground mt-1">
            {roleDescriptions[role]}
          </p>
        </div>
      </div>

      <div className="flex gap-2 justify-end">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={createInvitation.isPending}>
          {createInvitation.isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Invitation
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

// Invitations List Component
function InvitationsList({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const { data, isLoading } = useInvitations(orgId);
  const invitations = data?.invitations || [];
  const revokeInvitation = useRevokeInvitation(orgId);
  const { toast } = useToast();
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevoke = async (invitationId: string) => {
    setRevoking(invitationId);
    try {
      await revokeInvitation.mutateAsync(invitationId);
      toast({
        title: "Invitation revoked",
        description: "The invitation has been cancelled",
      });
    } catch (error) {
      toast({
        title: "Failed to revoke",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (date.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 0) return 'Expired';
    if (diffInHours < 24) return `Expires in ${Math.floor(diffInHours)}h`;
    return `Expires ${date.toLocaleDateString()}`;
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (invitations.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Mail className="h-5 w-5" />
          <span>Pending Invitations</span>
          <Badge variant="secondary">{invitations.length}</Badge>
        </CardTitle>
        <CardDescription>
          Invitations waiting to be accepted
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {invitations.map((invitation) => {
            const Icon = roleIcons[invitation.role];
            const isExpired = new Date(invitation.expiresAt) < new Date();
            
            return (
              <motion.div
                key={invitation.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{invitation.email}</p>
                      <Badge className={roleColors[invitation.role]} variant="secondary">
                        <Icon className="h-3 w-3 mr-1" />
                        {invitation.role}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span className={isExpired ? 'text-destructive' : ''}>
                        {formatDate(invitation.expiresAt)}
                      </span>
                    </div>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(invitation.id)}
                    disabled={revoking === invitation.id}
                  >
                    {revoking === invitation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                  </Button>
                )}
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Members List Component
function MembersList({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const { data, isLoading } = useOrganizationMembers(orgId);
  const members = data?.members || [];
  const updateRole = useUpdateMemberRole(orgId);
  const removeMember = useRemoveMember(orgId);
  const { toast } = useToast();
  const [removingMember, setRemovingMember] = useState<string | null>(null);

  const handleRoleChange = async (memberId: string, newRole: 'admin' | 'member' | 'viewer') => {
    try {
      await updateRole.mutateAsync({ memberId, role: newRole });
      toast({
        title: "Role updated",
        description: "Member role has been changed successfully",
      });
    } catch (error) {
      toast({
        title: "Failed to update role",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    }
  };

  const handleRemove = async (memberId: string) => {
    setRemovingMember(memberId);
    try {
      await removeMember.mutateAsync(memberId);
      toast({
        title: "Member removed",
        description: "The member has been removed from the organization",
      });
    } catch (error) {
      toast({
        title: "Failed to remove member",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    } finally {
      setRemovingMember(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Users className="h-5 w-5" />
          <span>Team Members</span>
          <Badge variant="secondary">{members.length}</Badge>
        </CardTitle>
        <CardDescription>
          Manage your organization's team members and their roles
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {members.map((member) => {
            const Icon = roleIcons[member.role];
            
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center justify-between p-4 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="rounded-full bg-primary/10 p-3">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{member.email}</p>
                      {member.user?.emailVerified && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Joined {new Date(member.joinedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {isAdmin ? (
                    <Select
                      value={member.role}
                      onValueChange={(val: any) => handleRoleChange(member.id, val)}
                    >
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(['admin', 'member', 'viewer'] as const).map((r) => {
                          const RoleIcon = roleIcons[r];
                          return (
                            <SelectItem key={r} value={r}>
                              <div className="flex items-center gap-2">
                                <RoleIcon className="h-4 w-4" />
                                <span className="capitalize">{r}</span>
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={roleColors[member.role]}>
                      <Icon className="h-3 w-3 mr-1" />
                      {member.role}
                    </Badge>
                  )}
                  
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemove(member.id)}
                      disabled={removingMember === member.id}
                    >
                      {removingMember === member.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </Button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// Create Organization Dialog
function CreateOrganizationDialog({
  open,
  onClose,
  onSuccess
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (orgId: string) => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const createOrg = useCreateOrganization();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const result = await createOrg.mutateAsync({ name, slug });
      toast({
        title: "Organization created!",
        description: `${name} has been created successfully`,
      });
      onSuccess(result.organization.id);
      setName('');
      setSlug('');
    } catch (error) {
      toast({
        title: "Failed to create organization",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create New Organization</DialogTitle>
          <DialogDescription>
            Set up a new organization for your team
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="org-name">Organization Name</Label>
            <Input
              id="org-name"
              placeholder="Acme Corporation"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                // Auto-generate slug
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
              }}
              required
            />
          </div>
          <div>
            <Label htmlFor="org-slug">URL Slug</Label>
            <Input
              id="org-slug"
              placeholder="acme-corp"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Used in URLs and must be unique
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={createOrg.isPending}>
              {createOrg.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Organization'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
