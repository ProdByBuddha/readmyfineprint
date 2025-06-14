import { useState } from "react";
import { Share2, Copy, Check, Facebook, Twitter, MessageCircle } from "lucide-react";
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
  title = "Read My Fine Print - Making Legal Documents Accessible",
  description = "Discover a platform that makes legal documents easier to understand for everyone. Join our mission to democratize legal literacy!",
  hashtags = ["legaltech", "accessibility", "transparency"],
  className = ""
}: SocialShareProps) => {
  const [copied, setCopied] = useState(false);

  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const encodedDescription = encodeURIComponent(description);
  const hashtagString = hashtags.map(tag => `#${tag}`).join(' ');

  // Mobile app URL schemes with web fallbacks
  const shareLinks = {
    twitter: {
      mobile: `twitter://post?message=${encodedTitle}%20${encodedUrl}%20${hashtags.map(tag => `%23${tag}`).join('%20')}`,
      web: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}&hashtags=${hashtags.join(',')}`
    },
    facebook: {
      mobile: `fb://sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`,
      web: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedTitle}`
    },
    linkedin: {
      mobile: `linkedin://shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`,
      web: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}&title=${encodedTitle}&summary=${encodedDescription}`
    },
    whatsapp: {
      mobile: `whatsapp://send?text=${encodedTitle}%20-%20${encodedDescription}%0A%0A${encodedUrl}%0A%0A${hashtagString}`,
      web: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`
    },
    reddit: {
      mobile: `reddit://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}&text=${encodedDescription}`,
      web: `https://reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`
    },
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

  const handleShare = (platform: string) => {
    if (platform === 'email') {
      window.location.href = shareLinks.email;
      return;
    }

    const platformLinks = shareLinks[platform as keyof Omit<typeof shareLinks, 'email'>];
    if (!platformLinks || typeof platformLinks === 'string') return;

    // Try mobile app first
    const mobileLink = platformLinks.mobile;
    const webLink = platformLinks.web;

    // Create a hidden iframe to test if the mobile app opens
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = mobileLink;
    document.body.appendChild(iframe);

    // Set a timeout to open web version if mobile app doesn't respond
    const fallbackTimer = setTimeout(() => {
      window.open(webLink, '_blank', 'width=600,height=400,scrollbars=yes,resizable=yes');
      document.body.removeChild(iframe);
    }, 1000);

    // Clean up iframe after a short delay
    setTimeout(() => {
      clearTimeout(fallbackTimer);
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 2000);

    // For better mobile detection, also try direct navigation on mobile devices
    if (/Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
      try {
        window.location.href = mobileLink;
        clearTimeout(fallbackTimer);
      } catch (e) {
        // If mobile app fails, the timeout will handle web fallback
      }
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
        <Share2 className="w-4 h-4" />
        Share with friends
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Twitter */}
        <Button
          variant="outline"
          size="default"
          onClick={() => handleShare('twitter')}
          className="flex items-center justify-center gap-2 h-14 px-4 text-sm hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20"
        >
          <Twitter className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <span className="truncate">Twitter</span>
        </Button>

        {/* Facebook */}
        <Button
          variant="outline"
          size="default"
          onClick={() => handleShare('facebook')}
          className="flex items-center justify-center gap-2 h-14 px-4 text-sm hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20"
        >
          <Facebook className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <span className="truncate">Facebook</span>
        </Button>

        {/* LinkedIn */}
        <Button
          variant="outline"
          size="default"
          onClick={() => handleShare('linkedin')}
          className="flex items-center justify-center gap-2 h-14 px-4 text-sm hover:bg-blue-50 hover:border-blue-200 dark:hover:bg-blue-900/20"
        >
          <div className="w-4 h-4 bg-blue-700 rounded-sm flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">in</span>
          </div>
          <span className="truncate">LinkedIn</span>
        </Button>

        {/* WhatsApp */}
        <Button
          variant="outline"
          size="default"
          onClick={() => handleShare('whatsapp')}
          className="flex items-center justify-center gap-2 h-14 px-4 text-sm hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-900/20"
        >
          <MessageCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
          <span className="truncate">WhatsApp</span>
        </Button>

        {/* Reddit */}
        <Button
          variant="outline"
          size="default"
          onClick={() => handleShare('reddit')}
          className="flex items-center justify-center gap-2 h-14 px-4 text-sm hover:bg-orange-50 hover:border-orange-200 dark:hover:bg-orange-900/20"
        >
          <div className="w-4 h-4 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">r</span>
          </div>
          <span className="truncate">Reddit</span>
        </Button>

        {/* Copy Link */}
        <Button
          variant="outline"
          size="default"
          onClick={handleCopyLink}
          className={`flex items-center justify-center gap-2 h-14 px-4 text-sm transition-colors ${
            copied
              ? 'bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-700 dark:text-green-400'
              : 'hover:bg-gray-50 hover:border-gray-200 dark:hover:bg-gray-800'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">Copy Link</span>
            </>
          )}
        </Button>
      </div>

      {/* Email sharing as a separate row */}
      <Button
        variant="outline"
        size="default"
        onClick={() => handleShare('email')}
        className="w-full flex items-center justify-center gap-2 h-14 px-4 text-sm hover:bg-gray-50 hover:border-gray-200 dark:hover:bg-gray-800"
      >
        <div className="w-4 h-4 bg-gray-600 rounded flex items-center justify-center flex-shrink-0">
          <span className="text-white text-xs">@</span>
        </div>
        <span className="truncate">Share via Email</span>
      </Button>
    </div>
  );
};
