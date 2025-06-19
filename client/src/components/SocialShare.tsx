
import { useState } from "react";
import * as Luc from "lucide-react";
import * as SimpleIcons from "simple-icons";
import { Button } from "@/components/ui/button";

interface SocialShareProps {
  url?: string;
  title?: string;
  description?: string;
  hashtags?: string[];
  className?: string;
}

export const SocialShare = ({
  url = window.location.href,
  title = "ReadMyFinePrint - Making Legal Documents Accessible",
  description = "Discover a platform that makes legal documents easier to understand for everyone. Join our mission to democratize legal literacy!",
  hashtags = ["legaltech", "accessibility", "transparency"],
  className = ""
}: SocialShareProps) => {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);

  // Simplified and fixed social share URLs
  const shareLinks = {
    twitter: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${hashtags.join(',')}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    whatsapp: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
    reddit: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    email: `mailto:?subject=${encodedTitle}&body=${encodedDescription}%0A%0A${encodedUrl}`
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleShare = (platform: keyof typeof shareLinks) => {
    const shareUrl = shareLinks[platform];
    
    if (platform === 'email') {
      window.location.href = shareUrl;
    } else {
      // Open in new window with proper dimensions
      const width = 600;
      const height = 400;
      const left = (window.innerWidth - width) / 2;
      const top = (window.innerHeight - height) / 2;
      
      window.open(
        shareUrl, 
        '_blank', 
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Luc.Share2 className="w-4 h-4" />
        Share with friends
      </div>

      <div className="grid grid-cols-3 gap-2">
        {/* Twitter */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('twitter')}
          className="flex items-center justify-center h-12 w-full hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20"
          title="Share on Twitter"
        >
          <span className="text-xs font-medium text-blue-500">Twitter</span>
        </Button>

        {/* LinkedIn */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('linkedin')}
          className="flex items-center justify-center h-12 w-full hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20"
          title="Share on LinkedIn"
        >
          <span className="text-xs font-medium text-blue-700">LinkedIn</span>
        </Button>

        {/* Reddit */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('reddit')}
          className="flex items-center justify-center h-12 w-full hover:bg-orange-50 hover:border-orange-200 dark:hover:bg-orange-900/20"
          title="Share on Reddit"
        >
          <span className="text-xs font-medium text-orange-500">Reddit</span>
        </Button>

        {/* Facebook */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('facebook')}
          className="flex items-center justify-center h-12 w-full hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20"
          title="Share on Facebook"
        >
          <span className="text-xs font-medium text-blue-600">Facebook</span>
        </Button>

        {/* WhatsApp */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('whatsapp')}
          className="flex items-center justify-center h-12 w-full hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-900/20"
          title="Share on WhatsApp"
        >
          <span className="text-xs font-medium text-green-600">WhatsApp</span>
        </Button>

        {/* Copy Link */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleCopyLink}
          className={`flex items-center justify-center h-12 w-full transition-colors ${
            copied
              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
              : 'hover:bg-gray-50 hover:border-gray-200 dark:hover:bg-gray-800'
          }`}
          title={copied ? "Copied!" : "Copy Link"}
        >
          <span className="text-xs font-medium">
            {copied ? "Copied!" : "Copy Link"}
          </span>
        </Button>

        {/* Email sharing */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleShare('email')}
          className="flex items-center justify-center h-12 w-full hover:bg-gray-50 hover:border-gray-200 dark:hover:bg-gray-800 col-span-3"
          title="Share via Email"
        >
          <span className="text-xs font-medium text-gray-600">Email</span>
        </Button>
      </div>
    </div>
  );
};
