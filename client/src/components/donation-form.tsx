import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Lock, CreditCard, CheckCircle, Heart } from "lucide-react";

interface DonationFormProps {
  amount: number;
  onSuccess: (amount: number) => void;
  onError: (error: string) => void;
}

interface CardData {
  number: string;
  expiry: string;
  cvc: string;
  name: string;
}

export default function DonationForm({ amount, onSuccess, onError }: DonationFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [cardData, setCardData] = useState<CardData>({
    number: '',
    expiry: '',
    cvc: '',
    name: ''
  });
  const [errors, setErrors] = useState<Partial<CardData>>({});

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiry = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const validateCard = (): boolean => {
    const newErrors: Partial<CardData> = {};
    
    if (!cardData.number || cardData.number.replace(/\s/g, '').length < 13) {
      newErrors.number = 'Please enter a valid card number';
    }
    
    if (!cardData.expiry || cardData.expiry.length < 5) {
      newErrors.expiry = 'Please enter expiry date (MM/YY)';
    }
    
    if (!cardData.cvc || cardData.cvc.length < 3) {
      newErrors.cvc = 'Please enter CVC';
    }
    
    if (!cardData.name.trim()) {
      newErrors.name = 'Please enter cardholder name';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    
    if (!validateCard()) {
      return;
    }

    if (amount < 1) {
      onError("Please enter a valid donation amount (minimum $1).");
      return;
    }

    setIsProcessing(true);

    try {
      // Process payment using server-side endpoint
      const response = await fetch('/api/process-donation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          amount,
          card: {
            number: cardData.number.replace(/\s/g, ''),
            exp_month: cardData.expiry.split('/')[0],
            exp_year: '20' + cardData.expiry.split('/')[1],
            cvc: cardData.cvc,
            name: cardData.name
          }
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      if (data.success) {
        onSuccess(amount);
        
        // Clear form
        setCardData({
          number: '',
          expiry: '',
          cvc: '',
          name: ''
        });
      } else if (data.requires_action) {
        // Handle 3D Secure or other authentication if needed
        onError("Payment requires additional authentication. Please try again.");
      } else {
        throw new Error("Payment processing failed");
      }
      
    } catch (err) {
      onError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = (field: keyof CardData, value: string) => {
    let formattedValue = value;
    
    if (field === 'number') {
      formattedValue = formatCardNumber(value);
    } else if (field === 'expiry') {
      formattedValue = formatExpiry(value);
    } else if (field === 'cvc') {
      formattedValue = value.replace(/[^0-9]/g, '').substring(0, 4);
    }
    
    setCardData(prev => ({ ...prev, [field]: formattedValue }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="w-5 h-5 text-red-500" />
          Support ReadMyFinePrint
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Alert className="mb-4">
          <CreditCard className="h-4 w-4" />
          <AlertDescription>
            <div className="text-sm">
              <p className="font-medium mb-1">Secure Payment Processing</p>
              <p>Your donation will be processed securely through Stripe.</p>
              <p>All transactions are encrypted and protected.</p>
            </div>
          </AlertDescription>
        </Alert>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="cardName">Cardholder Name</Label>
            <Input
              id="cardName"
              type="text"
              value={cardData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="John Doe"
              className={errors.name ? 'border-red-500' : ''}
              disabled={isProcessing}
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <Label htmlFor="cardNumber">Card Number</Label>
            <Input
              id="cardNumber"
              type="text"
              value={cardData.number}
              onChange={(e) => handleInputChange('number', e.target.value)}
              placeholder="1234 5678 9012 3456"
              maxLength={19}
              className={errors.number ? 'border-red-500' : ''}
              disabled={isProcessing}
            />
            {errors.number && <p className="text-sm text-red-500 mt-1">{errors.number}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="expiry">Expiry Date</Label>
              <Input
                id="expiry"
                type="text"
                value={cardData.expiry}
                onChange={(e) => handleInputChange('expiry', e.target.value)}
                placeholder="MM/YY"
                maxLength={5}
                className={errors.expiry ? 'border-red-500' : ''}
                disabled={isProcessing}
              />
              {errors.expiry && <p className="text-sm text-red-500 mt-1">{errors.expiry}</p>}
            </div>

            <div>
              <Label htmlFor="cvc">CVC</Label>
              <Input
                id="cvc"
                type="text"
                value={cardData.cvc}
                onChange={(e) => handleInputChange('cvc', e.target.value)}
                placeholder="123"
                maxLength={4}
                className={errors.cvc ? 'border-red-500' : ''}
                disabled={isProcessing}
              />
              {errors.cvc && <p className="text-sm text-red-500 mt-1">{errors.cvc}</p>}
            </div>
          </div>

          <Button
            type="submit"
            disabled={isProcessing || amount < 1}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing Donation...
              </>
            ) : (
              <>
                <Heart className="w-4 h-4 mr-2" />
                Donate ${amount.toFixed(2)}
              </>
            )}
          </Button>

          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-xs text-gray-400">
              <Lock className="w-3 h-3" />
              <span>Secure SSL encryption</span>
            </div>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}