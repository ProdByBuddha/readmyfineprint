import { TermsOfService } from "@/components/TermsOfService";
import { TouchScrollContainer } from "@/components/TouchScrollContainer";

export default function Terms() {
  return (
    <TouchScrollContainer className="h-full bg-background page-transition">
      <div className="container mx-auto px-4 py-4">
        <TermsOfService />
      </div>
    </TouchScrollContainer>
  );
}
