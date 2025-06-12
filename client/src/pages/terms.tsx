import { TermsOfService } from "@/components/TermsOfService";

export default function Terms() {
  return (
    <div className="h-full bg-gray-50 dark:bg-gray-900 page-transition overflow-y-auto">
      <div className="container mx-auto px-4 py-6">
        <TermsOfService />
      </div>
    </div>
  );
}
