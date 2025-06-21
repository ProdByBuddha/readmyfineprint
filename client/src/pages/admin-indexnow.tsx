
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Send, CheckCircle, XCircle, Info } from 'lucide-react';

interface IndexNowResult {
  success: boolean;
  searchEngine: string;
  statusCode: number;
  submittedUrls: number;
  error?: string;
}

export default function AdminIndexNow() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [results, setResults] = useState<IndexNowResult[]>([]);
  const [stats, setStats] = useState<any>(null);

  const handleSubmitAll = async () => {
    setIsSubmitting(true);
    setResults([]);

    try {
      const response = await fetch('/api/indexnow/submit-all', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to submit to IndexNow');
      }

      const data = await response.json();
      setResults(data.results || []);
      setStats(data.stats);
    } catch (error) {
      console.error('IndexNow submission failed:', error);
      // Show error state
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGetStats = async () => {
    try {
      const response = await fetch('/api/indexnow/stats', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('Failed to get IndexNow stats:', error);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">IndexNow Management</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Submit your URLs to search engines for faster indexing
          </p>
        </div>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Info className="w-5 h-5" />
              Configuration
            </CardTitle>
            <CardDescription>
              Current IndexNow configuration and statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {stats ? (
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Host:</strong> {stats.baseHost}
                </div>
                <div>
                  <strong>Public URLs:</strong> {stats.totalPublicUrls}
                </div>
                <div>
                  <strong>Verification Key:</strong> {stats.verificationKey.substring(0, 8)}...
                </div>
                <div>
                  <strong>Supported Engines:</strong> {stats.supportedEngines?.join(', ')}
                </div>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={handleGetStats}>
                Load Configuration
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Submit Button */}
        <Card>
          <CardHeader>
            <CardTitle>Submit URLs to Search Engines</CardTitle>
            <CardDescription>
              Submit all public URLs to Bing, Yandex, Naver, and Seznam for faster indexing
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={handleSubmitAll} 
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit All URLs
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {results.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Submission Results</CardTitle>
              <CardDescription>
                Results from the latest IndexNow submission
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {results.map((result, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      {result.success ? (
                        <CheckCircle className="w-5 h-5 text-green-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                      <div>
                        <div className="font-medium capitalize">{result.searchEngine}</div>
                        {result.error && (
                          <div className="text-sm text-red-600">{result.error}</div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={result.success ? "default" : "destructive"}>
                        {result.statusCode || 'Error'}
                      </Badge>
                      {result.success && (
                        <span className="text-sm text-gray-600">
                          {result.submittedUrls} URLs
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Information */}
        <Card>
          <CardHeader>
            <CardTitle>How IndexNow Works</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none">
            <ul className="space-y-2">
              <li><strong>Instant Notifications:</strong> Search engines are notified immediately when your content changes</li>
              <li><strong>Multiple Engines:</strong> Submits to Bing, Yandex, Naver, and Seznam automatically</li>
              <li><strong>Verification Key:</strong> Uses your domain verification key for authentication</li>
              <li><strong>No Rate Limits:</strong> IndexNow has no rate limits for legitimate submissions</li>
              <li><strong>Free Service:</strong> IndexNow is completely free to use</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
