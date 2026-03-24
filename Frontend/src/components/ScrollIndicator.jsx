const ScrollIndicator = () => {
  const handleScroll = () => {
    const nextSection = document.querySelector("#insights");

    if (nextSection) {
      nextSection.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  return (
    <button
      className="scroll-indicator"
      type="button"
      aria-label="Scroll to insights section"
      onClick={handleScroll}
    >
      <span className="scroll-indicator__label">Scroll</span>
      <span className="scroll-indicator__mouse">
        <span className="scroll-indicator__wheel" />
      </span>
      <span className="scroll-indicator__arrow" />
    </button>
  );
};

export default ScrollIndicator;
