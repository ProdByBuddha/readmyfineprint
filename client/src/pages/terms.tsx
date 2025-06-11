import { TermsOfService } from "@/components/TermsOfService";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export default function Terms() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="container mx-auto px-4 py-8">
        <TermsOfService />
      </div>
      <Footer />
    </div>
  );
}
