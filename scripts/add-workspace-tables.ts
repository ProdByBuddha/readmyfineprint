/**
 * Database Migration: Add Workspace and Collaboration Tables
 * Phase 2: Workspaces, Sharing, Annotations, and Activity
 * 
 * This migration adds:
 * - workspaces
 * - workspace_members
 * - documents_to_workspaces
 * - activity_events
 * - annotation_threads
 * - annotation_comments
 */

import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.NODE_ENV === 'production' ? 'require' : undefined,
});

async function migrate() {
  console.log('🚀 Starting Workspace Tables Migration...\n');

  try {
    // Create enum types
    console.log('Creating enum types...');
    
    await sql`
      DO $$ BEGIN
        CREATE TYPE workspace_visibility AS ENUM ('org', 'private');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    await sql`
      DO $$ BEGIN
        CREATE TYPE workspace_role AS ENUM ('owner', 'editor', 'commenter', 'viewer');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `;

    console.log('✅ Enum types created\n');

    // Create workspaces table
    console.log('Creating workspaces table...');
    await sql`
      CREATE TABLE IF NOT EXISTS workspaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        is_default BOOLEAN NOT NULL DEFAULT false,
        visibility workspace_visibility NOT NULL DEFAULT 'org',
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        archived_at TIMESTAMP,
        CONSTRAINT valid_name CHECK (length(name) >= 1 AND length(name) <= 200)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_workspaces_org_id ON workspaces(org_id) WHERE archived_at IS NULL;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_workspaces_created_by ON workspaces(created_by_user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_workspaces_default ON workspaces(org_id, is_default) WHERE is_default = true AND archived_at IS NULL;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_workspaces_visibility ON workspaces(org_id, visibility) WHERE archived_at IS NULL;`;

    console.log('✅ Workspaces table created\n');

    // Create workspace_members table
    console.log('Creating workspace_members table...');
    await sql`
      CREATE TABLE IF NOT EXISTS workspace_members (
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        role workspace_role NOT NULL DEFAULT 'viewer',
        added_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (workspace_id, user_id)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_workspace_members_role ON workspace_members(workspace_id, role);`;

    console.log('✅ Workspace_members table created\n');

    // Create documents_to_workspaces table
    console.log('Creating documents_to_workspaces table...');
    await sql`
      CREATE TABLE IF NOT EXISTS documents_to_workspaces (
        document_id INTEGER NOT NULL,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        added_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        PRIMARY KEY (document_id, workspace_id)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_docs_to_workspaces_workspace ON documents_to_workspaces(workspace_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_docs_to_workspaces_added_by ON documents_to_workspaces(added_by_user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_docs_to_workspaces_doc_id ON documents_to_workspaces(document_id);`;

    console.log('✅ Documents_to_workspaces table created\n');

    // Create activity_events table
    console.log('Creating activity_events table...');
    await sql`
      CREATE TABLE IF NOT EXISTS activity_events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action VARCHAR(100) NOT NULL,
        subject_type VARCHAR(50) NOT NULL,
        subject_id VARCHAR(100) NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT valid_action CHECK (length(action) >= 1)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_activity_org_id ON activity_events(org_id, created_at DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_workspace_id ON activity_events(workspace_id, created_at DESC) WHERE workspace_id IS NOT NULL;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_user_id ON activity_events(user_id, created_at DESC) WHERE user_id IS NOT NULL;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_action ON activity_events(action, created_at DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_activity_subject ON activity_events(subject_type, subject_id);`;

    console.log('✅ Activity_events table created\n');

    // Create annotation_threads table
    console.log('Creating annotation_threads table...');
    await sql`
      CREATE TABLE IF NOT EXISTS annotation_threads (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
        document_id INTEGER NOT NULL,
        anchor JSONB NOT NULL,
        is_resolved BOOLEAN NOT NULL DEFAULT false,
        created_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        resolved_at TIMESTAMP,
        CONSTRAINT valid_anchor CHECK (jsonb_typeof(anchor) = 'object')
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_annotation_threads_workspace ON annotation_threads(workspace_id, document_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_annotation_threads_doc ON annotation_threads(document_id) WHERE is_resolved = false;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_annotation_threads_created_by ON annotation_threads(created_by_user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_annotation_threads_org ON annotation_threads(org_id, created_at DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_annotation_threads_resolved ON annotation_threads(is_resolved, created_at DESC);`;

    console.log('✅ Annotation_threads table created\n');

    // Create annotation_comments table
    console.log('Creating annotation_comments table...');
    await sql`
      CREATE TABLE IF NOT EXISTS annotation_comments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        thread_id UUID NOT NULL REFERENCES annotation_threads(id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        body TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        edited_at TIMESTAMP,
        deleted_at TIMESTAMP,
        CONSTRAINT valid_body CHECK (length(body) >= 1 AND length(body) <= 10000)
      );
    `;

    await sql`CREATE INDEX IF NOT EXISTS idx_annotation_comments_thread ON annotation_comments(thread_id, created_at ASC) WHERE deleted_at IS NULL;`;
    await sql`CREATE INDEX IF NOT EXISTS idx_annotation_comments_user ON annotation_comments(user_id);`;

    console.log('✅ Annotation_comments table created\n');

    // Add workspace trigger for updated_at
    console.log('Creating workspace triggers...');
    await sql`DROP TRIGGER IF EXISTS update_workspaces_updated_at ON workspaces;`;
    
    await sql`
      CREATE TRIGGER update_workspaces_updated_at
        BEFORE UPDATE ON workspaces
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    `;

    console.log('✅ Triggers created\n');

    console.log('✅ Migration completed successfully!');
    console.log('\n📊 Summary:');
    console.log('  - workspaces table');
    console.log('  - workspace_members table');
    console.log('  - documents_to_workspaces table');
    console.log('  - activity_events table');
    console.log('  - annotation_threads table');
    console.log('  - annotation_comments table');
    console.log('\n🎉 Database is ready for Workspace and Collaboration features!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  } finally {
    await sql.end();
  }
}

// Run migration
migrate().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
