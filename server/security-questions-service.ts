import argon2 from 'argon2';
import { eq, and, sql } from 'drizzle-orm';
import { db } from './db';
import { securityQuestions } from '@shared/schema';
import type { SecurityQuestionRecord, InsertSecurityQuestion, SecurityQuestionsSetup, SecurityQuestion } from '@shared/schema';
import { SECURITY_QUESTIONS } from '@shared/schema';

export class SecurityQuestionsService {
  
  /**
   * Hash a security question answer using Argon2
   */
  private async hashAnswer(answer: string): Promise<string> {
    // Normalize the answer (trim whitespace, convert to lowercase)
    const normalizedAnswer = answer.trim().toLowerCase();
    
    // Use Argon2 with same settings as passwords for consistency
    return await argon2.hash(normalizedAnswer, {
      type: argon2.argon2id,
      memoryCost: 2 ** 16, // 64 MB
      timeCost: 3,
      parallelism: 1,
    });
  }

  /**
   * Verify a security question answer
   */
  private async verifyAnswer(hashedAnswer: string, providedAnswer: string): Promise<boolean> {
    try {
      const normalizedAnswer = providedAnswer.trim().toLowerCase();
      return await argon2.verify(hashedAnswer, normalizedAnswer);
    } catch (error) {
      console.error('Error verifying security answer:', error);
      return false;
    }
  }

  /**
   * Save security questions for a user during subscription
   */
  async saveSecurityQuestions(userId: string, questionsSetup: SecurityQuestionsSetup): Promise<void> {
    try {
      // Validate that all question IDs are valid
      const validQuestionIds = SECURITY_QUESTIONS.map(q => q.id);
      for (const q of questionsSetup.questions) {
        if (!validQuestionIds.includes(q.questionId)) {
          throw new Error(`Invalid question ID: ${q.questionId}`);
        }
      }

      // Hash all answers
      const securityQuestionsData: InsertSecurityQuestion[] = [];
      for (const q of questionsSetup.questions) {
        const hashedAnswer = await this.hashAnswer(q.answer);
        securityQuestionsData.push({
          userId,
          question: q.questionId,
          answerHash: hashedAnswer
        });
      }

      // Use a transaction to ensure atomicity
      await db.transaction(async (tx: any) => {
        // Delete existing security questions for this user first
        const deleteResult = await tx.delete(securityQuestions).where(eq(securityQuestions.userId, userId));
        console.log(`🗑️ Deleted ${deleteResult.rowCount || 0} existing security questions for user ${userId}`);

        // Insert new security questions
        await tx.insert(securityQuestions).values(securityQuestionsData);
      });

      console.log(`✅ Saved ${securityQuestionsData.length} security questions for user ${userId}`);
    } catch (error) {
      console.error('Error saving security questions:', error);
      throw new Error('Failed to save security questions');
    }
  }

  /**
   * Get security questions for a user (without answers)
   */
  async getUserSecurityQuestions(userId: string): Promise<SecurityQuestion[]> {
    try {
      const userQuestions = await db.select({
        question: securityQuestions.question
      }).from(securityQuestions).where(eq(securityQuestions.userId, userId));

      return userQuestions.map((uq: any) => {
        const question = SECURITY_QUESTIONS.find(q => q.id === uq.question);
        if (!question) {
          throw new Error(`Invalid question ID in database: ${uq.question}`);
        }
        return question;
      });
    } catch (error) {
      console.error('Error fetching user security questions:', error);
      throw new Error('Failed to fetch security questions');
    }
  }

  /**
   * Verify security question answers for a user
   */
  async verifySecurityQuestions(userId: string, answers: { [questionId: string]: string }): Promise<boolean> {
    try {
      const userQuestions = await db.select().from(securityQuestions).where(eq(securityQuestions.userId, userId));

      if (userQuestions.length === 0) {
        return false; // No security questions set up
      }

      // Check if all provided answers match
      for (const userQuestion of userQuestions) {
        const providedAnswer = answers[userQuestion.question];
        if (!providedAnswer) {
          return false; // Missing answer for a question
        }

        const isValid = await this.verifyAnswer(userQuestion.answerHash, providedAnswer);
        if (!isValid) {
          return false; // Invalid answer
        }
      }

      return true; // All answers are correct
    } catch (error) {
      console.error('Error verifying security questions:', error);
      return false;
    }
  }

  /**
   * Check if user has security questions set up
   */
  async hasSecurityQuestions(userId: string): Promise<boolean> {
    try {
      const count = await db.select().from(securityQuestions).where(eq(securityQuestions.userId, userId));
      return count.length > 0;
    } catch (error) {
      console.error('Error checking security questions:', error);
      return false;
    }
  }

  /**
   * Get available security questions for setup
   */
  getAvailableQuestions(): SecurityQuestion[] {
    return SECURITY_QUESTIONS;
  }

  /**
   * Update security questions for a user
   */
  async updateSecurityQuestions(userId: string, questionsSetup: SecurityQuestionsSetup): Promise<void> {
    // Same as saveSecurityQuestions - it replaces existing questions
    await this.saveSecurityQuestions(userId, questionsSetup);
  }

  /**
   * Delete all security questions for a user
   */
  async deleteSecurityQuestions(userId: string): Promise<void> {
    try {
      await db.delete(securityQuestions).where(eq(securityQuestions.userId, userId));
      console.log(`🗑️ Deleted security questions for user ${userId}`);
    } catch (error) {
      console.error('Error deleting security questions:', error);
      throw new Error('Failed to delete security questions');
    }
  }
}

export const securityQuestionsService = new SecurityQuestionsService();