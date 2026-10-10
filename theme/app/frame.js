// Runs `update` now and then at most once per frame while the page scrolls or resizes.
export const onScrollFrame = (update) => {
  let frame = 0;
  const schedule = () => {
    frame =
      frame ||
      requestAnimationFrame(() => {
        frame = 0;
        update();
      });
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule);
  update();
};
