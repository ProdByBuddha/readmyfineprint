import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Shield, AlertCircle, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import { getSecurityQuestions, setupSecurityQuestions } from '@/lib/api';

interface SecurityQuestion {
  id: string;
  question: string;
  required: boolean;
}

interface SecurityQuestionAnswer {
  questionId: string;
  answer: string;
}

interface SecurityQuestionsSetupProps {
  onComplete?: () => void;
  onSkip?: () => void;
  showSkipOption?: boolean;
  title?: string;
  description?: string;
  transparent?: boolean; // Don't apply background when true
}

export function SecurityQuestionsSetup({
  onComplete,
  onSkip,
  showSkipOption = false,
  title = "Set Up Security Questions",
  description = "Security questions help protect your account and can be used for account recovery.",
  transparent = false
}: SecurityQuestionsSetupProps) {
  const [availableQuestions, setAvailableQuestions] = useState<SecurityQuestion[]>([]);
  const [selectedQuestions, setSelectedQuestions] = useState<SecurityQuestionAnswer[]>([
    { questionId: '', answer: '' },
    { questionId: '', answer: '' }
  ]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchAvailableQuestions();
  }, []);

  const fetchAvailableQuestions = async () => {
    try {
      setFetching(true);
      const response = await getSecurityQuestions();
      setAvailableQuestions(response.questions);
    } catch (err) {
      setError('Failed to load security questions. Please try again.');
    } finally {
      setFetching(false);
    }
  };

  const addQuestion = () => {
    if (selectedQuestions.length < 4) {
      setSelectedQuestions([...selectedQuestions, { questionId: '', answer: '' }]);
    }
  };

  const removeQuestion = (index: number) => {
    if (selectedQuestions.length > 2) {
      const updated = selectedQuestions.filter((_, i) => i !== index);
      setSelectedQuestions(updated);
    }
  };

  const updateQuestion = (index: number, field: 'questionId' | 'answer', value: string) => {
    const updated = [...selectedQuestions];
    updated[index][field] = value;
    setSelectedQuestions(updated);
    
    // Clear success message when user starts editing
    if (success) {
      setSuccess(false);
    }
  };

  const getUsedQuestionIds = () => {
    return selectedQuestions.map(q => q.questionId).filter(id => id !== '');
  };

  const getAvailableOptionsForIndex = (currentIndex: number) => {
    const usedIds = getUsedQuestionIds();
    const currentQuestionId = selectedQuestions[currentIndex]?.questionId;
    
    return availableQuestions.filter(q => 
      !usedIds.includes(q.id) || q.id === currentQuestionId
    );
  };

  const validateForm = () => {
    const filledQuestions = selectedQuestions.filter(q => q.questionId && q.answer.trim());
    
    if (filledQuestions.length < 2) {
      setError('Please answer at least 2 security questions.');
      return false;
    }

    // Check for duplicate questions
    const questionIds = filledQuestions.map(q => q.questionId);
    const uniqueIds = new Set(questionIds);
    if (questionIds.length !== uniqueIds.size) {
      setError('Please select different questions for each answer.');
      return false;
    }

    // Check answer length
    for (const q of filledQuestions) {
      if (q.answer.trim().length < 1) {
        setError('Please provide answers for all selected questions.');
        return false;
      }
      if (q.answer.length > 100) {
        setError('Answers must be 100 characters or less.');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      
      const validQuestions = selectedQuestions.filter(q => q.questionId && q.answer.trim());
      
      await setupSecurityQuestions({
        questions: validQuestions
      });

      setSuccess(true);
      
      // Call onComplete after a short delay to show success message
      setTimeout(() => {
        onComplete?.();
      }, 1500);
      
    } catch (err: unknown) {
      const errorMessage = (err as any)?.response?.data?.error || 'Failed to save security questions. Please try again.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onSkip?.();
  };

  if (fetching) {
    return (
      <Card className={`w-full max-w-2xl mx-auto ${!transparent ? 'bg-white dark:bg-gray-800' : 'bg-transparent border-transparent shadow-none'}`}>
        <CardContent className={`flex items-center justify-center py-8 ${!transparent ? 'bg-white dark:bg-gray-800' : 'bg-transparent'}`}>
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          <span>Loading security questions...</span>
        </CardContent>
      </Card>
    );
  }

  if (success) {
    return (
      <Card className={`w-full max-w-2xl mx-auto ${!transparent ? 'bg-white dark:bg-gray-800' : 'bg-transparent border-transparent shadow-none'}`}>
        <CardContent className={`flex flex-col items-center justify-center py-8 text-center ${!transparent ? 'bg-white dark:bg-gray-800' : 'bg-transparent'}`}>
          <CheckCircle2 className="h-12 w-12 text-green-500 mb-4" />
          <h3 className="text-lg font-semibold mb-2">Security Questions Saved!</h3>
          <p className="text-gray-600 dark:text-gray-300">Your security questions have been set up successfully.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={`w-full max-w-2xl mx-auto ${!transparent ? 'bg-white dark:bg-gray-800' : 'bg-transparent border-transparent shadow-none'}`}>
      <CardHeader className={`${!transparent ? 'bg-white dark:bg-gray-800' : 'bg-transparent'}`}>
        <div className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-blue-500 dark:text-blue-400" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={`${!transparent ? 'bg-white dark:bg-gray-800' : 'bg-transparent'}`}>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-red-50 dark:bg-red-950/20">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            {selectedQuestions.map((selectedQuestion, index) => (
              <div key={index} className="p-4 border rounded-lg space-y-3 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">
                    Security Question {index + 1}
                    {index < 2 && <span className="text-red-500 ml-1">*</span>}
                  </Label>
                  {selectedQuestions.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeQuestion(index)}
                      className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                
                <Select
                  value={selectedQuestion.questionId}
                  onValueChange={(value) => updateQuestion(index, 'questionId', value)}
                >
                  <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600">
                    <SelectValue placeholder="Select a security question" className="text-gray-900 dark:text-white" />
                  </SelectTrigger>
                  <SelectContent className="bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600">
                    {getAvailableOptionsForIndex(index).map((question) => (
                      <SelectItem key={question.id} value={question.id} className="text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700">
                        {question.question}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {selectedQuestion.questionId && (
                  <div>
                    <Label htmlFor={`answer-${index}`} className="text-sm font-medium">
                      Your Answer
                    </Label>
                    <Input
                      id={`answer-${index}`}
                      type="text"
                      value={selectedQuestion.answer}
                      onChange={(e) => updateQuestion(index, 'answer', e.target.value)}
                      placeholder="Enter your answer"
                      maxLength={100}
                      className="mt-1"
                      required={selectedQuestion.questionId !== ''}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Answers are not case-sensitive. {selectedQuestion.answer.length}/100 characters
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>

          {selectedQuestions.length < 4 && (
            <Button
              type="button"
              variant="outline"
              onClick={addQuestion}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Another Question (Optional)
            </Button>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Saving...
                </>
              ) : (
                'Save Security Questions'
              )}
            </Button>
            
            {showSkipOption && (
              <Button
                type="button"
                variant="outline"
                onClick={handleSkip}
                disabled={loading}
              >
                Skip for Now
              </Button>
            )}
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 space-y-1">
            <p>• Answer at least 2 questions (up to 4 maximum)</p>
            <p>• Answers are stored securely using strong encryption</p>
            <p>• These questions can be used for account recovery</p>
            <p>• You can update your questions anytime in your account settings</p>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}