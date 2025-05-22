import { motion, useAnimation } from 'framer-motion';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

function AnimatedLayout({ children }) {
  const controls = useAnimation();
  const location = useLocation();
  const [visibleChildren, setVisibleChildren] = useState(children);

  useEffect(() => {
    async function animateTransition() {
      // Step 1: Slide overlay in
      await controls.start({
        x: 0,
        transition: { duration: 0.6, ease: 'easeInOut' },
      });

      // Step 2: Swap content once overlay is fully in
      setVisibleChildren(children);

      // Step 3: Slide overlay out
      await controls.start({
        x: '100%',
        transition: { duration: 0.6, ease: 'easeInOut' },
      });

      // Reset overlay offscreen
      controls.set({ x: '-100%' });
    }

    animateTransition();
  }, [location.pathname]); // Trigger transition on route/pathname change

  return (
    <>
      <motion.div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'orange',
          zIndex: 999,
        }}
        initial={{ x: '-100%' }}
        animate={controls}
      />

      <div style={{ position: 'relative', zIndex: 1 }}>
        {visibleChildren}
      </div>
    </>
  );
}

export default AnimatedLayout;
