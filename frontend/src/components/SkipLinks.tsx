export function SkipLinks() {
  const handleSkipClick = (e: React.MouseEvent<HTMLAnchorElement>, targetId: string) => {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (target) {
      target.setAttribute('tabindex', '-1');
      target.focus();
      target.addEventListener('blur', () => {
        target.removeAttribute('tabindex');
      }, { once: true });
    }
  };

  return (
    <div className="skip-links">
      <a
        href="#main-content"
        onClick={(e) => handleSkipClick(e, 'main-content')}
        className="skip-link"
      >
        Skip to main content
      </a>
      <a
        href="#watchlist"
        onClick={(e) => handleSkipClick(e, 'watchlist')}
        className="skip-link"
      >
        Skip to watchlist
      </a>
      <a
        href="#chart"
        onClick={(e) => handleSkipClick(e, 'chart')}
        className="skip-link"
      >
        Skip to chart
      </a>
      <a
        href="#news"
        onClick={(e) => handleSkipClick(e, 'news')}
        className="skip-link"
      >
        Skip to news
      </a>
    </div>
  );
}
