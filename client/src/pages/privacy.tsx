import { PrivacyPolicy } from "@/components/PrivacyPolicy";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />
      <div className="container mx-auto px-4 py-8 pb-32">
        <PrivacyPolicy />
      </div>
      <Footer />
    </div>
  );
}
