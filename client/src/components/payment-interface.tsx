import StripePaymentForm from "@/components/StripePaymentForm";

interface PaymentInterfaceProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

export default function PaymentInterface({ amount, onSuccess, onError }: PaymentInterfaceProps) {
  return (
    <StripePaymentForm
      amount={amount}
      onSuccess={onSuccess}
      onError={onError}
    />
  );
}