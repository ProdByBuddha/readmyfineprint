#!/usr/bin/env tsx
/**
 * Add RLHF (Reinforcement Learning from Human Feedback) tables for PII detection improvement
 * This script adds the necessary tables to store user feedback on PII detection accuracy
 */

import { sql } from 'drizzle-orm';
import { initializeDatabase } from '../server/db-with-fallback';

console.log('🤖 Adding RLHF feedback tables for PII detection improvement...');

async function addRlhfFeedbackTables() {
  try {
    const db = await initializeDatabase();
    
    console.log('🏗️ Creating RLHF feedback tables...');
    
    // 1. PII Detection Feedback table - stores individual user votes
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pii_detection_feedback (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_pseudonym TEXT NOT NULL,
        detection_session_id TEXT NOT NULL,
        
        -- Detection details
        detected_text TEXT NOT NULL,
        detection_type TEXT NOT NULL,
        detection_method TEXT NOT NULL,
        confidence DECIMAL(3, 2) NOT NULL,
        context TEXT,
        
        -- User feedback
        user_vote TEXT NOT NULL,
        feedback_confidence INTEGER,
        feedback_reason TEXT,
        
        -- Document context (anonymized)
        document_type TEXT,
        document_length INTEGER,
        
        -- Tracking and analytics
        ip_hash TEXT NOT NULL,
        user_agent_hash TEXT NOT NULL,
        
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ PII detection feedback table created');
    
    // 2. PII Detection Metrics table - stores aggregated metrics over time
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pii_detection_metrics (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Aggregation period and scope
        period TEXT NOT NULL,
        period_start TIMESTAMP NOT NULL,
        period_end TIMESTAMP NOT NULL,
        
        -- Detection pattern aggregation
        detection_type TEXT NOT NULL,
        detection_method TEXT NOT NULL,
        
        -- Aggregated metrics
        total_detections INTEGER DEFAULT 0 NOT NULL,
        total_feedback INTEGER DEFAULT 0 NOT NULL,
        correct_votes INTEGER DEFAULT 0 NOT NULL,
        incorrect_votes INTEGER DEFAULT 0 NOT NULL,
        partially_correct_votes INTEGER DEFAULT 0 NOT NULL,
        
        -- Calculated accuracy metrics
        accuracy_rate DECIMAL(5, 4),
        false_positive_rate DECIMAL(5, 4),
        confidence_average DECIMAL(3, 2),
        
        -- Pattern analysis
        common_false_positives TEXT,
        improvement_suggestions TEXT,
        
        last_updated TIMESTAMP DEFAULT now() NOT NULL,
        created_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ PII detection metrics table created');
    
    // 3. PII Detection Patterns table - stores learned patterns and their performance
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS pii_detection_patterns (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        
        -- Pattern identification
        pattern_hash TEXT UNIQUE NOT NULL,
        pattern_type TEXT NOT NULL,
        description TEXT NOT NULL,
        
        -- Pattern details
        detection_type TEXT NOT NULL,
        pattern_content TEXT NOT NULL,
        confidence_threshold DECIMAL(3, 2) NOT NULL,
        
        -- Learning metrics
        total_uses INTEGER DEFAULT 0 NOT NULL,
        correct_detections INTEGER DEFAULT 0 NOT NULL,
        incorrect_detections INTEGER DEFAULT 0 NOT NULL,
        
        -- Status and management
        is_active BOOLEAN DEFAULT true NOT NULL,
        is_learned BOOLEAN DEFAULT false NOT NULL,
        learning_confidence DECIMAL(3, 2),
        
        -- Version control
        version INTEGER DEFAULT 1 NOT NULL,
        parent_pattern_id UUID REFERENCES pii_detection_patterns(id),
        
        created_at TIMESTAMP DEFAULT now() NOT NULL,
        updated_at TIMESTAMP DEFAULT now() NOT NULL
      )
    `);
    console.log('✅ PII detection patterns table created');
    
    // Create indexes for better performance
    console.log('📇 Creating RLHF feedback indexes...');
    
    // Feedback table indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_feedback_session_pseudonym ON pii_detection_feedback(session_pseudonym)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_feedback_detection_session_id ON pii_detection_feedback(detection_session_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_feedback_detection_type ON pii_detection_feedback(detection_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_feedback_detection_method ON pii_detection_feedback(detection_method)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_feedback_user_vote ON pii_detection_feedback(user_vote)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_feedback_created_at ON pii_detection_feedback(created_at)`);
    
    // Metrics table indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_metrics_period ON pii_detection_metrics(period, period_start, period_end)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_metrics_detection_type ON pii_detection_metrics(detection_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_metrics_detection_method ON pii_detection_metrics(detection_method)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_metrics_accuracy_rate ON pii_detection_metrics(accuracy_rate)`);
    
    // Patterns table indexes
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_patterns_pattern_hash ON pii_detection_patterns(pattern_hash)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_patterns_detection_type ON pii_detection_patterns(detection_type)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_patterns_is_active ON pii_detection_patterns(is_active)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_patterns_is_learned ON pii_detection_patterns(is_learned)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS idx_pii_patterns_parent_pattern_id ON pii_detection_patterns(parent_pattern_id)`);
    
    console.log('✅ All RLHF feedback indexes created');
    
    // Add constraints and validation
    console.log('🔒 Adding constraints and validation...');
    
    // Add check constraints for valid enum values
    await db.execute(sql`
      ALTER TABLE pii_detection_feedback
      ADD CONSTRAINT chk_pii_feedback_detection_type 
      CHECK (detection_type IN ('ssn', 'email', 'phone', 'creditCard', 'address', 'name', 'dob', 'custom', 'attorney_client'))
    `);
    
    await db.execute(sql`
      ALTER TABLE pii_detection_feedback
      ADD CONSTRAINT chk_pii_feedback_detection_method 
      CHECK (detection_method IN ('regex', 'context', 'fuzzy', 'composite', 'llm'))
    `);
    
    await db.execute(sql`
      ALTER TABLE pii_detection_feedback
      ADD CONSTRAINT chk_pii_feedback_user_vote 
      CHECK (user_vote IN ('correct', 'incorrect', 'partially_correct'))
    `);
    
    await db.execute(sql`
      ALTER TABLE pii_detection_feedback
      ADD CONSTRAINT chk_pii_feedback_confidence 
      CHECK (confidence >= 0.00 AND confidence <= 1.00)
    `);
    
    await db.execute(sql`
      ALTER TABLE pii_detection_feedback
      ADD CONSTRAINT chk_pii_feedback_feedback_confidence 
      CHECK (feedback_confidence IS NULL OR (feedback_confidence >= 1 AND feedback_confidence <= 5))
    `);
    
    console.log('✅ Constraints and validation added');
    
    // Test the tables by counting rows
    const feedbackResult = await db.execute(sql`SELECT COUNT(*) as count FROM pii_detection_feedback`);
    const metricsResult = await db.execute(sql`SELECT COUNT(*) as count FROM pii_detection_metrics`);
    const patternsResult = await db.execute(sql`SELECT COUNT(*) as count FROM pii_detection_patterns`);
    
    console.log(`✅ RLHF feedback tables setup complete!`);
    console.log(`   - Feedback records: ${feedbackResult[0].count}`);
    console.log(`   - Metrics records: ${metricsResult[0].count}`);
    console.log(`   - Pattern records: ${patternsResult[0].count}`);
    
  } catch (error) {
    console.error('❌ Error adding RLHF feedback tables:', error);
    process.exit(1);
  }
}

// Run the setup
addRlhfFeedbackTables().then(() => {
  console.log('🎉 RLHF feedback tables are ready for use!');
  console.log('📌 Users can now provide feedback on PII detection accuracy');
  process.exit(0);
});