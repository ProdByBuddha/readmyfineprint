# 🚀 Workspace Frontend - In Progress

**Date:** 2025-10-01
**Status:** React Query Hooks Complete ✅ | Components In Progress 🔄

---

## ✅ Completed: React Query Hooks

### File Created: `client/src/hooks/useWorkspaces.ts` (327 lines)

Comprehensive React Query hooks for all workspace operations with automatic cache management and TypeScript types.

### Query Hooks (4)

1. **`useWorkspaces(orgId)`**
   - Fetches all workspaces for an organization
   - Returns workspace list with member/document counts
   - Includes user's role in each workspace
   - 2-minute stale time

2. **`useWorkspace(workspaceId)`**
   - Fetches detailed workspace information
   - Returns workspace with aggregated counts
   - Includes user's effective role
   - 2-minute stale time

3. **`useWorkspaceMembers(workspaceId)`**
   - Fetches all members of a workspace
   - Returns member list with user details
   - Includes email verification status
   - 2-minute stale time

4. **`useWorkspaceDocuments(workspaceId)`**
   - Fetches all documents shared to workspace
   - Returns document list with metadata
   - 1-minute stale time (more dynamic)

### Mutation Hooks (8)

1. **`useCreateWorkspace(orgId)`**
   - Creates new workspace in organization
   - Auto-invalidates workspace list
   - Supports all workspace properties

2. **`useUpdateWorkspace(workspaceId)`**
   - Updates workspace settings
   - Auto-invalidates workspace details and list
   - Supports partial updates

3. **`useDeleteWorkspace(workspaceId, orgId)`**
   - Archives workspace (soft delete)
   - Removes from cache completely
   - Invalidates workspace list

4. **`useAddWorkspaceMember(workspaceId)`**
   - Adds member to workspace
   - Updates member count
   - Comprehensive error handling

5. **`useUpdateWorkspaceMemberRole(workspaceId)`**
   - Changes member's role
   - Invalidates member list
   - Type-safe role parameter

6. **`useRemoveWorkspaceMember(workspaceId)`**
   - Removes member from workspace
   - Updates member count
   - Protects last owner (handled by backend)

7. **`useShareDocument(workspaceId)`**
   - Shares document to workspace
   - Updates document count
   - Prevents duplicates (backend validation)

8. **`useUnshareDocument(workspaceId)`**
   - Removes document from workspace
   - Updates document count
   - Immediate cache update

### TypeScript Types

All hooks are fully typed with comprehensive interfaces:

```typescript
interface Workspace {
  id: string;
  orgId: string;
  name: string;
  description: string | null;
  visibility: 'org' | 'private';
  isDefault: boolean;
  memberCount: number;
  documentCount: number;
  role: 'owner' | 'editor' | 'commenter' | 'viewer' | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceMember {
  workspaceId: string;
  userId: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  email: string;
  emailVerified: boolean;
  addedByUserId: string | null;
  createdAt: string;
}

interface WorkspaceDocument {
  documentId: number;
  workspaceId: string;
  addedByUserId: string;
  createdAt: string;
}
```

### Features

✅ **Automatic Cache Management**
- Smart cache invalidation on mutations
- Optimized stale times per data type
- Cache removal on delete operations

✅ **Error Handling**
- Comprehensive error messages
- Backend error pass-through
- Type-safe error objects

✅ **Optimistic Updates**
- Member count updates
- Document count updates
- Immediate UI feedback

✅ **Query Dependencies**
- Proper `enabled` flags
- Conditional fetching
- No unnecessary requests

---

## ⏭️ Next: Workspace Components

### Components to Build

1. **`WorkspaceManagement.tsx`** - Main container
   - Workspace list/grid view
   - Create workspace dialog
   - Workspace selector
   - Organization context

2. **`WorkspaceCard.tsx`** - Individual workspace display
   - Workspace name and description
   - Member/document counts
   - Role badge
   - Visibility indicator
   - Quick actions menu

3. **`CreateWorkspaceDialog.tsx`** - Create workspace modal
   - Name input
   - Description textarea
   - Visibility toggle (org/private)
   - Default checkbox
   - Form validation

4. **`WorkspaceDetails.tsx`** - Detailed workspace view
   - Workspace settings
   - Member management
   - Document list
   - Activity feed (future)

5. **`WorkspaceMembersList.tsx`** - Member management
   - Member list with roles
   - Add member button
   - Role selector
   - Remove member action

6. **`WorkspaceDocumentsList.tsx`** - Document management
   - Document list
   - Share button
   - Unshare action
   - Document preview/link

### UI Design Patterns

Following the existing team management design:
- **Purple/blue gradient accents**
- **Role-based badges**
  - 👑 Owner (purple)
  - ✏️ Editor (blue)
  - 💬 Commenter (green)
  - 👁️ Viewer (gray)
- **Visibility indicators**
  - 🏢 Org-visible
  - 🔒 Private
- **Card-based layout**
- **Framer Motion animations**
- **Dark mode support**
- **Mobile responsive**

### Integration Points

1. **Settings Page**
   - Add new "Workspaces" tab
   - Or integrate into existing "Team" tab
   - Organization selector at top

2. **Document Pages**
   - "Share to Workspace" button
   - Workspace selector dropdown
   - Show shared workspaces badge

3. **Navigation**
   - Workspace quick switcher
   - Recent workspaces
   - Default workspace link

---

## 📊 Progress Tracking

### Overall Frontend Progress

| Component | Status | Lines |
|-----------|--------|-------|
| React Query Hooks | ✅ Complete | 327 |
| WorkspaceManagement | ⏭️ Next | 0 |
| WorkspaceCard | 📋 Planned | 0 |
| CreateWorkspaceDialog | 📋 Planned | 0 |
| WorkspaceDetails | 📋 Planned | 0 |
| MembersList | 📋 Planned | 0 |
| DocumentsList | 📋 Planned | 0 |
| Settings Integration | 📋 Planned | 0 |

**Estimated Total:** ~800-1000 lines of React components

---

## 🎯 Implementation Plan

### Phase 1: Core Components (Next Session)
1. Create `WorkspaceManagement.tsx` main container
2. Create `CreateWorkspaceDialog.tsx` modal
3. Create `WorkspaceCard.tsx` for display
4. Basic list/grid view working

### Phase 2: Member Management
1. Create `WorkspaceMembersList.tsx`
2. Add member dialog
3. Role selector
4. Remove member confirmation

### Phase 3: Document Sharing
1. Create `WorkspaceDocumentsList.tsx`
2. Share document dialog
3. Unshare confirmation
4. Document preview/links

### Phase 4: Settings Integration
1. Add Workspaces tab to settings
2. Organization context provider
3. Workspace selector
4. Polish and animations

### Phase 5: Document Integration
1. Add "Share to Workspace" button to document pages
2. Workspace selector dropdown
3. Show shared status
4. Unshare from document view

---

## 🎨 Design Mockup

```
┌─────────────────────────────────────────────────┐
│ Settings > Workspaces                           │
├─────────────────────────────────────────────────┤
│                                                 │
│  Organization: [Acme Corp ▼]     [+ Create]   │
│                                                 │
│  ┌────────────┐  ┌────────────┐  ┌──────────┐ │
│  │ 🏢 General  │  │ 🔒 Private │  │ ✏️ Design│ │
│  │            │  │            │  │          │ │
│  │ 12 members │  │ 3 members  │  │ 5 members│ │
│  │ 45 docs    │  │ 8 docs     │  │ 23 docs  │ │
│  │            │  │            │  │          │ │
│  │ [Owner] 👑 │  │ [Editor] ✏️│  │ [Owner] 👑│
│  └────────────┘  └────────────┘  └──────────┘ │
│                                                 │
│  Selected: General Workspace                    │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ Members (12)                    [+ Add] │  │
│  ├─────────────────────────────────────────┤  │
│  │ 👑 john@acme.com      Owner     [Edit]  │  │
│  │ ✏️ jane@acme.com      Editor    [Edit]  │  │
│  │ 👁️ bob@acme.com       Viewer    [Edit]  │  │
│  └─────────────────────────────────────────┘  │
│                                                 │
│  ┌─────────────────────────────────────────┐  │
│  │ Shared Documents (45)           [Share] │  │
│  ├─────────────────────────────────────────┤  │
│  │ 📄 Q4 Planning.pdf         [View] [×]   │  │
│  │ 📄 Budget 2025.xlsx        [View] [×]   │  │
│  │ 📄 Team Structure.doc      [View] [×]   │  │
│  └─────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

---

## 🔗 API Integration

All hooks ready to connect to these endpoints:

- `GET /api/orgs/:orgId/workspaces` ✅
- `POST /api/orgs/:orgId/workspaces` ✅
- `GET /api/workspaces/:workspaceId` ✅
- `PATCH /api/workspaces/:workspaceId` ✅
- `DELETE /api/workspaces/:workspaceId` ✅
- `GET /api/workspaces/:workspaceId/members` ✅
- `POST /api/workspaces/:workspaceId/members` ✅
- `PATCH /api/workspaces/:workspaceId/members/:userId` ✅
- `DELETE /api/workspaces/:workspaceId/members/:userId` ✅
- `GET /api/workspaces/:workspaceId/documents` ✅
- `POST /api/workspaces/:workspaceId/documents` ✅
- `DELETE /api/workspaces/:workspaceId/documents/:documentId` ✅

---

## 📝 Usage Example

```typescript
import { useWorkspaces, useCreateWorkspace } from '@/hooks/useWorkspaces';

function WorkspacesPage() {
  const orgId = 'org-123';
  const { data, isLoading } = useWorkspaces(orgId);
  const createWorkspace = useCreateWorkspace(orgId);

  const handleCreate = async () => {
    await createWorkspace.mutateAsync({
      name: 'New Workspace',
      description: 'A fresh workspace',
      visibility: 'org',
      isDefault: false,
    });
  };

  if (isLoading) return <div>Loading...</div>;

  return (
    <div>
      <button onClick={handleCreate}>Create Workspace</button>
      {data?.workspaces.map(workspace => (
        <WorkspaceCard key={workspace.id} workspace={workspace} />
      ))}
    </div>
  );
}
```

---

## ✅ Summary

**Phase 1 Complete!** 🎉

✅ 327 lines of React Query hooks
✅ 12 hooks covering all operations
✅ Full TypeScript typing
✅ Automatic cache management
✅ Comprehensive error handling
✅ Ready for component development

**Next:** Build workspace management components!
