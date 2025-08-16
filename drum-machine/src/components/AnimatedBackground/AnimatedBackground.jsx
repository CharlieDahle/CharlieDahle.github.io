import React, { useState, useEffect, useMemo } from "react";

function AnimatedBackground({
  blobCount = [2, 6], // Range [min, max] for random blob count
  colors = ["#5bc0eb", "#fde74c", "#9bc53d", "#e55934", "#fa7921", "#ff97c4"],
  excludeAreas = [], // Array of areas to avoid: { top, bottom, left, right }
  className = "",
  style = {},
}) {
  const [backgroundBlobs, setBackgroundBlobs] = useState([]);

  // Memoize all props to prevent unnecessary re-renders
  const memoizedBlobCount = useMemo(
    () => blobCount,
    [Array.isArray(blobCount) ? JSON.stringify(blobCount) : blobCount]
  );
  const memoizedExcludeAreas = useMemo(
    () => excludeAreas,
    [JSON.stringify(excludeAreas)]
  );
  const memoizedColors = useMemo(() => colors, [JSON.stringify(colors)]);

  useEffect(() => {
    const generateBlobs = () => {
      const blobShapes = [
        `polygon(25% 3%, 16% 10%, 6% 18%, 2% 29%, 0% 46%, 0% 67%, 6% 79%, 16% 86%, 25% 93%, 38% 96%, 54% 96%, 69% 95%, 84% 89%, 97% 79%, 100% 62%, 100% 49%, 100% 33%, 97% 24%, 89% 18%, 79% 10%, 67% 8%, 54% 6%, 38% 3%)`,
        `polygon(28% 4%, 18% 11%, 8% 19%, 3% 31%, 1% 47%, 2% 69%, 8% 81%, 18% 87%, 28% 94%, 40% 97%, 55% 97%, 71% 95%, 85% 89%, 97% 80%, 100% 63%, 99% 50%, 98% 34%, 94% 25%, 86% 18%, 76% 11%, 64% 9%, 50% 7%, 35% 4%)`,
        `polygon(26% 2%, 16% 12%, 4% 18%, 0% 30%, 2% 46%, 1% 68%, 7% 80%, 17% 85%, 27% 92%, 39% 95%, 54% 95%, 70% 93%, 82% 87%, 95% 78%, 99% 61%, 98% 48%, 99% 32%, 95% 22%, 87% 16%, 77% 9%, 65% 7%, 52% 5%, 36% 2%)`,
        `polygon(24% 5%, 14% 9%, 5% 16%, 2% 28%, 0% 44%, 1% 66%, 5% 78%, 14% 87%, 24% 94%, 36% 98%, 52% 98%, 68% 96%, 84% 90%, 98% 81%, 100% 64%, 100% 51%, 100% 35%, 98% 26%, 91% 19%, 81% 12%, 69% 10%, 55% 8%, 39% 5%)`,
        `polygon(27% 1%, 17% 8%, 7% 15%, 3% 27%, 1% 43%, 0% 65%, 6% 77%, 16% 84%, 26% 91%, 38% 94%, 54% 94%, 70% 92%, 82% 86%, 94% 77%, 98% 60%, 98% 47%, 98% 31%, 94% 21%, 86% 14%, 76% 7%, 64% 5%, 51% 3%, 36% 1%)`,
        `polygon(26% 4%, 16% 11%, 7% 19%, 2% 31%, 0% 47%, 1% 69%, 8% 82%, 19% 88%, 30% 95%, 42% 98%, 58% 98%, 74% 96%, 87% 91%, 97% 82%, 100% 65%, 99% 52%, 98% 36%, 93% 27%, 84% 20%, 74% 13%, 61% 11%, 47% 9%, 33% 4%)`,
      ];

      // Handle blob count as either number or range
      let actualBlobCount;
      if (Array.isArray(memoizedBlobCount)) {
        const [min, max] = memoizedBlobCount;
        actualBlobCount = Math.floor(Math.random() * (max - min + 1)) + min;
      } else {
        actualBlobCount =
          memoizedBlobCount || Math.floor(Math.random() * 4) + 2;
      }

      const blobs = [];
      const shuffledColors = [...memoizedColors].sort(
        () => Math.random() - 0.5
      );

      // Default exclusion area for centered content (like cards)
      const defaultExcludeArea = { top: 25, bottom: 75, left: 25, right: 75 };
      const areasToAvoid =
        memoizedExcludeAreas.length > 0
          ? memoizedExcludeAreas
          : [defaultExcludeArea];

      for (let i = 0; i < actualBlobCount; i++) {
        let position;
        let attempts = 0;

        do {
          const size = Math.floor(Math.random() * 150) + 150;
          const sizePercent = (size / window.innerWidth) * 100;

          // Generate position outside excluded areas
          let top, left;

          // Choose a zone outside excluded areas
          const zone = Math.floor(Math.random() * 4);

          switch (zone) {
            case 0: // Top area
              top = Math.random() * (areasToAvoid[0].top - 5) + 2;
              left = Math.random() * (90 - sizePercent) + 5;
              break;
            case 1: // Left area
              top = Math.random() * 60 + 15;
              left = Math.random() * (areasToAvoid[0].left - 5) + 2;
              break;
            case 2: // Right area
              top = Math.random() * 60 + 15;
              left =
                Math.random() * (90 - areasToAvoid[0].right - sizePercent) +
                areasToAvoid[0].right +
                5;
              break;
            case 3: // Bottom area
              top =
                Math.random() * (90 - areasToAvoid[0].bottom - sizePercent) +
                areasToAvoid[0].bottom +
                5;
              left = Math.random() * (90 - sizePercent) + 5;
              break;
          }

          position = { top, left, size };
          attempts++;
        } while (isTooClose(position, blobs) && attempts < 50);

        const randomShape =
          blobShapes[Math.floor(Math.random() * blobShapes.length)];
        const uniqueColor = shuffledColors[i % shuffledColors.length];

        blobs.push({
          id: i,
          ...position,
          color: uniqueColor,
          clipPath: randomShape,
          animationDelay: Math.random() * -20,
          animationDuration: 15 + Math.random() * 10,
        });
      }

      setBackgroundBlobs(blobs);
    };

    const isTooClose = (newPos, existingBlobs) => {
      const minDistance = 35;
      return existingBlobs.some((blob) => {
        const distance = Math.sqrt(
          Math.pow(newPos.top - blob.top, 2) +
            Math.pow(newPos.left - blob.left, 2)
        );
        return distance < minDistance;
      });
    };

    generateBlobs();
  }, [memoizedBlobCount, memoizedColors, memoizedExcludeAreas]); // Use all memoized versions

  const backgroundStyle = {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 0,
    overflow: "hidden",
    ...style,
  };

  const blobStyle = {
    position: "absolute",
    opacity: 0.5,
    animation: "float infinite ease-in-out",
  };

  return (
    <div className={`animated-background ${className}`} style={backgroundStyle}>
      <style>
        {`
          @keyframes float {
            0%, 100% {
              transform: translate(0px, 0px) rotate(0deg);
            }
            33% {
              transform: translate(30px, -30px) rotate(120deg);
            }
            66% {
              transform: translate(-20px, 20px) rotate(240deg);
            }
          }
        `}
      </style>
      {backgroundBlobs.map((blob) => (
        <div
          key={blob.id}
          style={{
            ...blobStyle,
            top: `${blob.top}%`,
            left: `${blob.left}%`,
            width: `${blob.size}px`,
            height: `${blob.size}px`,
            backgroundColor: blob.color,
            clipPath: blob.clipPath,
            animationDelay: `${blob.animationDelay}s`,
            animationDuration: `${blob.animationDuration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default AnimatedBackground;
