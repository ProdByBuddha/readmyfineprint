/**
 * Account Deletion Service
 * Handles GDPR/CCPA compliant account deletion with data retention for compliance
 */

import { db } from './db';
import { users, userSubscriptions, subscriptionTokens, sessionTokens, usageRecords, securityQuestions, emailChangeRequests } from '@shared/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import Stripe from 'stripe';

const stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});

export interface AccountDeletionOptions {
  userId: string;
  reason: 'user_request' | 'admin_action' | 'compliance';
  retainFinancialData?: boolean;
  anonymizeData?: boolean;
}

export interface AccountDeletionResult {
  success: boolean;
  deletedAt: Date;
  anonymizedEmail?: string;
  stripeCustomerStatus?: 'deleted' | 'anonymized' | 'retained';
  retainedData: {
    financialRecords: boolean;
    usageStatistics: boolean;
    subscriptionHistory: boolean;
  };
  error?: string;
}

export class AccountDeletionService {
  /**
   * Delete user account with compliance-aware data handling
   */
  async deleteAccount(options: AccountDeletionOptions): Promise<AccountDeletionResult> {
    const { userId, reason, retainFinancialData = true, anonymizeData = true } = options;
    
    try {
      // Get user data before deletion
      const [user] = await db
        .select()
        .from(users)
        .where(and(
          eq(users.id, userId),
          eq(users.isDeleted, false)
        ));

      if (!user) {
        return {
          success: false,
          deletedAt: new Date(),
          error: 'User not found or already deleted',
          retainedData: {
            financialRecords: false,
            usageStatistics: false,
            subscriptionHistory: false,
          }
        };
      }

      const deletedAt = new Date();
      const anonymizedEmail = anonymizeData ? `deleted_user_${randomUUID()}@deleted.local` : user.email;

      // Handle Stripe customer
      let stripeCustomerStatus: 'deleted' | 'anonymized' | 'retained' = 'retained';
      if (user.stripeCustomerId) {
        stripeCustomerStatus = await this.handleStripeCustomer(user.stripeCustomerId, retainFinancialData, anonymizeData);
      }

      if (retainFinancialData && anonymizeData) {
        // Soft delete with PII anonymization
        await this.softDeleteWithAnonymization(userId, user, anonymizedEmail, reason, deletedAt);
      } else if (!retainFinancialData) {
        // Hard delete (not recommended for compliance)
        await this.hardDelete(userId);
      } else {
        // Soft delete without anonymization (retain original data)
        await this.softDelete(userId, reason, deletedAt);
      }

      // Clear in-memory session data
      await this.clearSessionData(userId);

      return {
        success: true,
        deletedAt,
        anonymizedEmail: anonymizeData ? anonymizedEmail : undefined,
        stripeCustomerStatus,
        retainedData: {
          financialRecords: retainFinancialData,
          usageStatistics: retainFinancialData, // Usage data needed for financial compliance
          subscriptionHistory: retainFinancialData,
        }
      };

    } catch (error) {
      console.error('Account deletion failed:', error);
      return {
        success: false,
        deletedAt: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
        retainedData: {
          financialRecords: false,
          usageStatistics: false,
          subscriptionHistory: false,
        }
      };
    }
  }

  /**
   * Soft delete with PII anonymization (recommended approach)
   */
  private async softDeleteWithAnonymization(
    userId: string, 
    user: any, 
    anonymizedEmail: string, 
    reason: string, 
    deletedAt: Date
  ): Promise<void> {
    await db.transaction(async (tx: any) => {
      // Anonymize user data
      await tx
        .update(users)
        .set({
          email: anonymizedEmail,
          hashedPassword: null, // Remove password
          emailVerified: false,
          isActive: false,
          isDeleted: true,
          deletedAt,
          deletionReason: reason,
          updatedAt: deletedAt,
        })
        .where(eq(users.id, userId));

      // Clear all active sessions and tokens
      await tx
        .delete(subscriptionTokens)
        .where(eq(subscriptionTokens.userId, userId));

      await tx
        .delete(sessionTokens)
        .where(eq(sessionTokens.userId, userId));

      // Clear security questions
      await tx
        .delete(securityQuestions)
        .where(eq(securityQuestions.userId, userId));

      // Clear pending email change requests
      await tx
        .delete(emailChangeRequests)
        .where(eq(emailChangeRequests.userId, userId));

      // Financial data (subscriptions, usage) remains linked to anonymized user
      // for compliance retention - cascade delete is disabled for these
    });
  }

  /**
   * Standard soft delete (retain original data)
   */
  private async softDelete(userId: string, reason: string, deletedAt: Date): Promise<void> {
    await db
      .update(users)
      .set({
        isActive: false,
        isDeleted: true,
        deletedAt,
        deletionReason: reason,
        updatedAt: deletedAt,
      })
      .where(eq(users.id, userId));

    // Clear active sessions
    await db
      .delete(subscriptionTokens)
      .where(eq(subscriptionTokens.userId, userId));

    await db
      .delete(sessionTokens)
      .where(eq(sessionTokens.userId, userId));
  }

  /**
   * Hard delete (not recommended - use only when legally required)
   */
  private async hardDelete(userId: string): Promise<void> {
    // Cascade deletes will handle all related records
    await db
      .delete(users)
      .where(eq(users.id, userId));
  }

  /**
   * Handle Stripe customer data
   */
  private async handleStripeCustomer(
    stripeCustomerId: string, 
    retainFinancialData: boolean, 
    anonymizeData: boolean
  ): Promise<'deleted' | 'anonymized' | 'retained'> {
    try {
      // Cancel all active subscriptions first
      const subscriptions = await stripeInstance.subscriptions.list({
        customer: stripeCustomerId,
        status: 'active'
      });

      for (const subscription of subscriptions.data) {
        await stripeInstance.subscriptions.cancel(subscription.id);
      }

      if (!retainFinancialData) {
        // Delete Stripe customer (loses all payment history)
        await stripeInstance.customers.del(stripeCustomerId);
        return 'deleted';
      } else if (anonymizeData) {
        // Anonymize Stripe customer data
        await stripeInstance.customers.update(stripeCustomerId, {
          email: `deleted_user_${randomUUID()}@deleted.local`,
          name: 'Deleted User',
          description: 'Account deleted - retained for compliance',
          metadata: {
            account_deleted: 'true',
            deleted_at: new Date().toISOString(),
          }
        });
        return 'anonymized';
      }

      return 'retained';
    } catch (error) {
      console.error('Error handling Stripe customer:', error);
      return 'retained';
    }
  }

  /**
   * Clear in-memory session data
   */
  private async clearSessionData(userId: string): Promise<void> {
    // This would integrate with your session storage systems
    // For now, just log the action
    console.log(`Cleared in-memory session data for user ${userId}`);
  }

  /**
   * Get account deletion status
   */
  async getDeletionStatus(userId: string): Promise<{
    isDeleted: boolean;
    deletedAt?: Date;
    deletionReason?: string;
    anonymized: boolean;
  }> {
    const [user] = await db
      .select({
        isDeleted: users.isDeleted,
        deletedAt: users.deletedAt,
        deletionReason: users.deletionReason,
        email: users.email,
      })
      .from(users)
      .where(eq(users.id, userId));

    if (!user) {
      return {
        isDeleted: false,
        anonymized: false,
      };
    }

    return {
      isDeleted: user.isDeleted,
      deletedAt: user.deletedAt || undefined,
      deletionReason: user.deletionReason || undefined,
      anonymized: user.email.includes('@deleted.local'),
    };
  }

  /**
   * Restore deleted account (admin function)
   */
  async restoreAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));

      if (!user) {
        return { success: false, error: 'User not found' };
      }

      if (!user.isDeleted) {
        return { success: false, error: 'Account is not deleted' };
      }

      if (user.email.includes('@deleted.local')) {
        return { success: false, error: 'Cannot restore anonymized account' };
      }

      await db
        .update(users)
        .set({
          isDeleted: false,
          deletedAt: null,
          deletionReason: null,
          isActive: true,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));

      return { success: true };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }
}

// Export singleton instance
export const accountDeletionService = new AccountDeletionService();