
interface SkipLinksProps {
  links?: Array<{ href: string; label: string }>;
}

export function SkipLinks({ links }: SkipLinksProps) {
  const defaultLinks = [
    { href: '#main-content', label: 'Skip to main content' },
    { href: '#navigation', label: 'Skip to navigation' },
    { href: '#footer', label: 'Skip to footer' },
  ];

  const skipLinks = links || defaultLinks;

  return (
    <nav role="navigation" aria-label="Skip links" className="sr-only focus-within:not-sr-only">
      <ul className="flex gap-2 p-4 bg-black text-white fixed top-0 left-0 z-50">
        {skipLinks.map((link, index) => (
          <li key={index}>
            <a
              href={link.href}
              className="skip-link bg-black text-white px-4 py-2 rounded focus:outline-none focus:ring-2 focus:ring-white"
              onClick={(e) => {
                e.preventDefault();
                const target = document.querySelector(link.href);
                if (target instanceof HTMLElement) {
                  target.focus();
                  target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
              }}
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
} 