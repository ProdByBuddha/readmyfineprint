import React from 'react';
import { UserSecuritySettings } from '@/components/UserSecuritySettings';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Account Settings
          </h1>
          <p className="mt-2 text-gray-600 dark:text-gray-300">
            Manage your security settings and account preferences
          </p>
        </div>
        
        <UserSecuritySettings />
      </div>
    </div>
  );
}