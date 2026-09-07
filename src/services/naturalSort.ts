/**
 * Natural sort comparison for filenames and chapter titles.
 * Handles:
 * "1.jpg", "2.jpg", "10.jpg" -> correct numeric order
 * "第1话", "第2话", "第10话" -> correct numeric order
 */
export function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

/**
 * Checks if a filename is an image based on its extension.
 */
export function isImageFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif'].includes(ext || '');
}

/**
 * Checks if a filename is a PDF document based on its extension.
 */
export function isPdfFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext === 'pdf';
}

