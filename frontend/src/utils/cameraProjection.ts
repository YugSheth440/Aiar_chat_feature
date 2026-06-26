export function mapCameraBoxToScreen(
  cameraWidth: number,
  cameraHeight: number,
  screenWidth: number,
  screenHeight: number,
  normalizedBox: number[]
): { x: number; y: number; width: number; height: number } {
  // VisionCamera resizeMode="cover" logic
  // The camera sensor might be 1920x1080 (16:9), but the screen is 2400x1080 (~20:9)
  // "Cover" scales the image to fill the screen, cropping the excess.
  
  const screenAspect = screenWidth / screenHeight;
  const cameraAspect = cameraWidth / cameraHeight;
  
  let scaleX = 1;
  let scaleY = 1;
  let offsetX = 0;
  let offsetY = 0;

  if (cameraAspect > screenAspect) {
    // Camera is wider than screen -> cropped on left/right
    scaleY = screenHeight;
    scaleX = screenHeight * cameraAspect;
    offsetX = -(scaleX - screenWidth) / 2;
  } else {
    // Camera is taller than screen -> cropped on top/bottom
    scaleX = screenWidth;
    scaleY = screenWidth / cameraAspect;
    offsetY = -(scaleY - screenHeight) / 2;
  }

  const [nx1, ny1, nx2, ny2] = normalizedBox;
  
  const x1 = nx1 * scaleX + offsetX;
  const y1 = ny1 * scaleY + offsetY;
  const x2 = nx2 * scaleX + offsetX;
  const y2 = ny2 * scaleY + offsetY;

  return {
    x: x1,
    y: y1,
    width: x2 - x1,
    height: y2 - y1,
  };
}
