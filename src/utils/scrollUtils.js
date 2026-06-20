export const forceSmoothScroll = (targetY, duration = 400, onComplete) => {
  // Mathematically clamp the target so we don't scroll past the physical bottom of the document
  const scrollHeight = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
  const maxScroll = Math.max(0, scrollHeight - window.innerHeight);
  const clampedTargetY = Math.min(targetY, maxScroll);
  
  console.log(`[Navigation Engine] Scroll Requested: ${targetY}, Max Valid Scroll: ${maxScroll}, Clamped To: ${clampedTargetY}`);
  
  const startY = window.scrollY;
  const distance = clampedTargetY - startY;
  const startTime = performance.now();
  
  // Temporarily lock native scrolling so trackpads don't cancel the animation
  document.documentElement.style.overflow = 'hidden';
  
  const animateScroll = (currentTime) => {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    
    window.scrollTo(0, startY + distance * easeProgress);
    
    if (progress < 1) {
      requestAnimationFrame(animateScroll);
    } else {
      document.documentElement.style.overflow = '';
      if (onComplete) onComplete();
    }
  };
  requestAnimationFrame(animateScroll);
};
