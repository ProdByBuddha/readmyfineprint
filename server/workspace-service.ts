/**
 * Workspace Service
 * Handles workspace CRUD operations, member management, and document sharing
 */

import { db } from './db';
import { 
  workspaces, 
  workspaceMembers, 
  documentsToWorkspaces, 
  organizations,
  organizationUsers,
  users 
} from '@shared/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';

export interface CreateWorkspaceInput {
  orgId: string;
  name: string;
  description?: string;
  visibility: 'org' | 'private';
  isDefault?: boolean;
  createdByUserId: string;
}

export interface UpdateWorkspaceInput {
  name?: string;
  description?: string;
  visibility?: 'org' | 'private';
  isDefault?: boolean;
}

export interface AddWorkspaceMemberInput {
  workspaceId: string;
  userId: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  addedByUserId: string;
}

export interface ShareDocumentInput {
  workspaceId: string;
  documentId: number;
  addedByUserId: string;
}

/**
 * Create a new workspace
 */
export async function createWorkspace(input: CreateWorkspaceInput) {
  const { orgId, name, description, visibility, isDefault, createdByUserId } = input;

  // Verify organization exists
  const org = await db
    .select()
    .from(organizations)
    .where(and(
      eq(organizations.id, orgId),
      sql`${organizations.deletedAt} IS NULL`
    ))
    .limit(1);

  if (org.length === 0) {
    throw new Error('Organization not found');
  }

  // Verify user is a member of the organization
  const membership = await db
    .select()
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.userId, createdByUserId)
    ))
    .limit(1);

  if (membership.length === 0) {
    throw new Error('User is not a member of this organization');
  }

  // If setting as default, unset other defaults
  if (isDefault) {
    await db
      .update(workspaces)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(
        eq(workspaces.orgId, orgId),
        eq(workspaces.isDefault, true),
        sql`${workspaces.archivedAt} IS NULL`
      ));
  }

  // Create workspace
  const [workspace] = await db
    .insert(workspaces)
    .values({
      orgId,
      name,
      description: description || null,
      visibility,
      isDefault: isDefault || false,
      createdByUserId,
    })
    .returning();

  // Add creator as owner
  await db
    .insert(workspaceMembers)
    .values({
      workspaceId: workspace.id,
      userId: createdByUserId,
      role: 'owner',
      addedByUserId: null,
    });

  return workspace;
}

/**
 * Get workspace by ID
 */
export async function getWorkspaceById(workspaceId: string, userId: string) {
  // Get workspace with member count
  const workspace = await db
    .select({
      id: workspaces.id,
      orgId: workspaces.orgId,
      name: workspaces.name,
      description: workspaces.description,
      isDefault: workspaces.isDefault,
      visibility: workspaces.visibility,
      createdByUserId: workspaces.createdByUserId,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      archivedAt: workspaces.archivedAt,
      memberCount: sql<number>`COUNT(DISTINCT ${workspaceMembers.userId})::int`,
      documentCount: sql<number>`COUNT(DISTINCT ${documentsToWorkspaces.documentId})::int`,
    })
    .from(workspaces)
    .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .leftJoin(documentsToWorkspaces, eq(documentsToWorkspaces.workspaceId, workspaces.id))
    .where(and(
      eq(workspaces.id, workspaceId),
      sql`${workspaces.archivedAt} IS NULL`
    ))
    .groupBy(workspaces.id)
    .limit(1);

  if (workspace.length === 0) {
    throw new Error('Workspace not found');
  }

  // Get user's role in workspace (if member)
  const membership = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ))
    .limit(1);

  // Get user's org role
  const orgMembership = await db
    .select({ role: organizationUsers.role })
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, workspace[0].orgId),
      eq(organizationUsers.userId, userId)
    ))
    .limit(1);

  // Determine effective role
  let effectiveRole: string | null = null;
  if (membership.length > 0) {
    effectiveRole = membership[0].role;
  } else if (orgMembership.length > 0 && workspace[0].visibility === 'org') {
    // Org members get viewer access to org-visible workspaces
    effectiveRole = 'viewer';
  }

  return {
    ...workspace[0],
    role: effectiveRole,
  };
}

/**
 * List workspaces for an organization
 */
export async function listWorkspacesByOrg(orgId: string, userId: string) {
  // Get user's org role
  const orgMembership = await db
    .select({ role: organizationUsers.role })
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, orgId),
      eq(organizationUsers.userId, userId)
    ))
    .limit(1);

  if (orgMembership.length === 0) {
    throw new Error('User is not a member of this organization');
  }

  // Get all workspaces where user has access
  // (org-visible workspaces OR workspaces where user is a member)
  const workspacesList = await db
    .select({
      id: workspaces.id,
      orgId: workspaces.orgId,
      name: workspaces.name,
      description: workspaces.description,
      isDefault: workspaces.isDefault,
      visibility: workspaces.visibility,
      createdByUserId: workspaces.createdByUserId,
      createdAt: workspaces.createdAt,
      updatedAt: workspaces.updatedAt,
      memberCount: sql<number>`COUNT(DISTINCT ${workspaceMembers.userId})::int`,
      documentCount: sql<number>`COUNT(DISTINCT ${documentsToWorkspaces.documentId})::int`,
    })
    .from(workspaces)
    .leftJoin(workspaceMembers, eq(workspaceMembers.workspaceId, workspaces.id))
    .leftJoin(documentsToWorkspaces, eq(documentsToWorkspaces.workspaceId, workspaces.id))
    .where(and(
      eq(workspaces.orgId, orgId),
      sql`${workspaces.archivedAt} IS NULL`,
      sql`(
        ${workspaces.visibility} = 'org' 
        OR EXISTS (
          SELECT 1 FROM workspace_members wm 
          WHERE wm.workspace_id = ${workspaces.id} 
          AND wm.user_id = ${userId}
        )
      )`
    ))
    .groupBy(workspaces.id)
    .orderBy(sql`${workspaces.isDefault} DESC`, workspaces.createdAt);

  // Get user's roles for each workspace
  const workspaceIds = workspacesList.map(w => w.id);
  const userMemberships = workspaceIds.length > 0
    ? await db
        .select({
          workspaceId: workspaceMembers.workspaceId,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .where(and(
          inArray(workspaceMembers.workspaceId, workspaceIds),
          eq(workspaceMembers.userId, userId)
        ))
    : [];

  const membershipMap = new Map(
    userMemberships.map(m => [m.workspaceId, m.role])
  );

  return workspacesList.map(workspace => ({
    ...workspace,
    role: membershipMap.get(workspace.id) || (workspace.visibility === 'org' ? 'viewer' : null),
  }));
}

/**
 * Update workspace
 */
export async function updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput) {
  const { name, description, visibility, isDefault } = input;

  // Get workspace to check if it exists
  const existing = await db
    .select()
    .from(workspaces)
    .where(and(
      eq(workspaces.id, workspaceId),
      sql`${workspaces.archivedAt} IS NULL`
    ))
    .limit(1);

  if (existing.length === 0) {
    throw new Error('Workspace not found');
  }

  // If setting as default, unset other defaults in same org
  if (isDefault) {
    await db
      .update(workspaces)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(and(
        eq(workspaces.orgId, existing[0].orgId),
        eq(workspaces.isDefault, true),
        sql`${workspaces.archivedAt} IS NULL`
      ));
  }

  const updateData: any = { updatedAt: new Date() };
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (visibility !== undefined) updateData.visibility = visibility;
  if (isDefault !== undefined) updateData.isDefault = isDefault;

  const [updated] = await db
    .update(workspaces)
    .set(updateData)
    .where(eq(workspaces.id, workspaceId))
    .returning();

  return updated;
}

/**
 * Delete workspace (soft delete)
 */
export async function deleteWorkspace(workspaceId: string) {
  const [deleted] = await db
    .update(workspaces)
    .set({ 
      archivedAt: new Date(),
      updatedAt: new Date()
    })
    .where(and(
      eq(workspaces.id, workspaceId),
      sql`${workspaces.archivedAt} IS NULL`
    ))
    .returning();

  if (!deleted) {
    throw new Error('Workspace not found');
  }

  return { success: true, workspaceId };
}

/**
 * Add member to workspace
 */
export async function addWorkspaceMember(input: AddWorkspaceMemberInput) {
  const { workspaceId, userId, role, addedByUserId } = input;

  // Verify workspace exists
  const workspace = await db
    .select()
    .from(workspaces)
    .where(and(
      eq(workspaces.id, workspaceId),
      sql`${workspaces.archivedAt} IS NULL`
    ))
    .limit(1);

  if (workspace.length === 0) {
    throw new Error('Workspace not found');
  }

  // Verify user is a member of the organization
  const orgMembership = await db
    .select()
    .from(organizationUsers)
    .where(and(
      eq(organizationUsers.orgId, workspace[0].orgId),
      eq(organizationUsers.userId, userId)
    ))
    .limit(1);

  if (orgMembership.length === 0) {
    throw new Error('User is not a member of this organization');
  }

  // Check if already a member
  const existing = await db
    .select()
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('User is already a member of this workspace');
  }

  // Add member
  const [member] = await db
    .insert(workspaceMembers)
    .values({
      workspaceId,
      userId,
      role,
      addedByUserId,
    })
    .returning();

  return member;
}

/**
 * List workspace members
 */
export async function listWorkspaceMembers(workspaceId: string) {
  const members = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      addedByUserId: workspaceMembers.addedByUserId,
      createdAt: workspaceMembers.createdAt,
      email: users.email,
      emailVerified: users.emailVerified,
    })
    .from(workspaceMembers)
    .leftJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(workspaceMembers.createdAt);

  return members;
}

/**
 * Update workspace member role
 */
export async function updateWorkspaceMemberRole(
  workspaceId: string,
  userId: string,
  role: 'owner' | 'editor' | 'commenter' | 'viewer'
) {
  const [updated] = await db
    .update(workspaceMembers)
    .set({ role })
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ))
    .returning();

  if (!updated) {
    throw new Error('Member not found');
  }

  return updated;
}

/**
 * Remove member from workspace
 */
export async function removeWorkspaceMember(workspaceId: string, userId: string) {
  // Check if user is the last owner
  const owners = await db
    .select()
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.role, 'owner')
    ));

  if (owners.length === 1 && owners[0].userId === userId) {
    throw new Error('Cannot remove the last owner of the workspace');
  }

  const deleted = await db
    .delete(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ))
    .returning();

  if (deleted.length === 0) {
    throw new Error('Member not found');
  }

  return { success: true };
}

/**
 * Share document to workspace
 */
export async function shareDocumentToWorkspace(input: ShareDocumentInput) {
  const { workspaceId, documentId, addedByUserId } = input;

  // Verify workspace exists
  const workspace = await db
    .select()
    .from(workspaces)
    .where(and(
      eq(workspaces.id, workspaceId),
      sql`${workspaces.archivedAt} IS NULL`
    ))
    .limit(1);

  if (workspace.length === 0) {
    throw new Error('Workspace not found');
  }

  // Check if already shared
  const existing = await db
    .select()
    .from(documentsToWorkspaces)
    .where(and(
      eq(documentsToWorkspaces.workspaceId, workspaceId),
      eq(documentsToWorkspaces.documentId, documentId)
    ))
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Document is already shared to this workspace');
  }

  // Share document
  const [shared] = await db
    .insert(documentsToWorkspaces)
    .values({
      workspaceId,
      documentId,
      addedByUserId,
    })
    .returning();

  return shared;
}

/**
 * List documents in workspace
 */
export async function listWorkspaceDocuments(workspaceId: string) {
  const documents = await db
    .select({
      documentId: documentsToWorkspaces.documentId,
      workspaceId: documentsToWorkspaces.workspaceId,
      addedByUserId: documentsToWorkspaces.addedByUserId,
      createdAt: documentsToWorkspaces.createdAt,
    })
    .from(documentsToWorkspaces)
    .where(eq(documentsToWorkspaces.workspaceId, workspaceId))
    .orderBy(documentsToWorkspaces.createdAt);

  return documents;
}

/**
 * Unshare document from workspace
 */
export async function unshareDocumentFromWorkspace(workspaceId: string, documentId: number) {
  const deleted = await db
    .delete(documentsToWorkspaces)
    .where(and(
      eq(documentsToWorkspaces.workspaceId, workspaceId),
      eq(documentsToWorkspaces.documentId, documentId)
    ))
    .returning();

  if (deleted.length === 0) {
    throw new Error('Document not found in workspace');
  }

  return { success: true };
}

/**
 * Check if user has access to workspace
 */
export async function hasWorkspaceAccess(workspaceId: string, userId: string): Promise<boolean> {
  const workspace = await db
    .select({ orgId: workspaces.orgId, visibility: workspaces.visibility })
    .from(workspaces)
    .where(and(
      eq(workspaces.id, workspaceId),
      sql`${workspaces.archivedAt} IS NULL`
    ))
    .limit(1);

  if (workspace.length === 0) {
    return false;
  }

  // Check if user is a workspace member
  const membership = await db
    .select()
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ))
    .limit(1);

  if (membership.length > 0) {
    return true;
  }

  // If org-visible, check if user is org member
  if (workspace[0].visibility === 'org') {
    const orgMembership = await db
      .select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.orgId, workspace[0].orgId),
        eq(organizationUsers.userId, userId)
      ))
      .limit(1);

    return orgMembership.length > 0;
  }

  return false;
}

/**
 * Get user's role in workspace
 */
export async function getUserWorkspaceRole(
  workspaceId: string,
  userId: string
): Promise<'owner' | 'editor' | 'commenter' | 'viewer' | null> {
  const workspace = await db
    .select({ orgId: workspaces.orgId, visibility: workspaces.visibility })
    .from(workspaces)
    .where(and(
      eq(workspaces.id, workspaceId),
      sql`${workspaces.archivedAt} IS NULL`
    ))
    .limit(1);

  if (workspace.length === 0) {
    return null;
  }

  // Check direct workspace membership first
  const membership = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, userId)
    ))
    .limit(1);

  if (membership.length > 0) {
    return membership[0].role as any;
  }

  // If org-visible, org members get viewer access
  if (workspace[0].visibility === 'org') {
    const orgMembership = await db
      .select()
      .from(organizationUsers)
      .where(and(
        eq(organizationUsers.orgId, workspace[0].orgId),
        eq(organizationUsers.userId, userId)
      ))
      .limit(1);

    if (orgMembership.length > 0) {
      return 'viewer';
    }
  }

  return null;
}
