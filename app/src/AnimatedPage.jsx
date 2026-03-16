import { motion } from 'framer-motion'

const pageVariants = {
  initial: { 
    scale: 0.8, 
    opacity: 0,
    y: 50
  },
  in: { 
    scale: 1, 
    opacity: 1,
    y: 0
  },
  out: { 
    scale: 0.8, 
    opacity: 0,
    y: -50
  }
}

const pageTransition = {
  type: "spring",
  stiffness: 100,
  damping: 15,
  mass: 0.8
}

function AnimatedPage({ children }) {
  return (
    <motion.div
      initial="initial"
      animate="in"
      exit="out"
      variants={pageVariants}
      transition={pageTransition}
      style={{
        width: '100%',
        minHeight: '100vh'
      }}
    >
      {children}
    </motion.div>
  )
}

export default AnimatedPage