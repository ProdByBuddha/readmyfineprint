import { TermsOfService } from "@/components/TermsOfService";
import { Header } from "@/components/Header";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-transition">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24 pb-40">
        <TermsOfService />
      </div>
    </div>
  );
}
