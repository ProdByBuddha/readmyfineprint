import { PrivacyPolicy } from "@/components/PrivacyPolicy";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-transition">
      <div className="container mx-auto px-4 py-6 pt-20 pb-32">
        <PrivacyPolicy />
      </div>
    </div>
  );
}
