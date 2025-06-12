import { CookiePolicy } from "@/components/CookiePolicy";

export default function Cookies() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 pt-24 pb-40">
        <CookiePolicy />
      </div>
    </div>
  );
}