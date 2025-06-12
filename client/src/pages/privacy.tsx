import { PrivacyPolicy } from "@/components/PrivacyPolicy";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 page-transition">
      <Header />
      <div className="container mx-auto px-4 py-8 pt-24 pb-40">
        <PrivacyPolicy />
      </div>
      <Footer />
    </div>
  );
}
