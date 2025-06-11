import DonationForm from "@/components/donation-form";

interface PaymentInterfaceProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

export default function PaymentInterface({ amount, onSuccess, onError }: PaymentInterfaceProps) {
  return (
    <DonationForm
      amount={amount}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}