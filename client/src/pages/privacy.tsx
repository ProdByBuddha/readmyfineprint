import { PrivacyPolicy } from "@/components/PrivacyPolicy";
import { TouchScrollContainer } from "@/components/TouchScrollContainer";

export default function Privacy() {
  return (
    <TouchScrollContainer className="h-full bg-background page-transition">
      <div className="container mx-auto px-4 py-4">
        <PrivacyPolicy />
      </div>
    </TouchScrollContainer>
  );
}
