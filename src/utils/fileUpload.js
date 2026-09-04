/**
 * Shared helper for building FormData file parts that work on both
 * web (blob: / data: URIs) and mobile (file:// URIs via RN native streaming).
 */

/**
 * Appends a single file to a FormData instance, handling platform differences.
 *
 * @param {FormData} formData - The FormData instance to append to.
 * @param {string} fieldName - The multipart field name (e.g. 'images', 'video', 'file').
 * @param {object} file - The file object from expo-image-picker ({ uri, mimeType?, fileName?, type? }).
 * @param {object} options - Optional overrides.
 * @param {string} options.fallbackName - Fallback filename if file.fileName is absent.
 * @param {string} options.fallbackType - Fallback MIME type (default: 'image/jpeg').
 */
export async function appendFilePart(formData, fieldName, file, options = {}) {
  if (!file || !file.uri) return;

  const { fallbackName = 'file.jpg', fallbackType = 'image/jpeg' } = options;
  const mimeType = (file.mimeType && file.mimeType.includes('/')) ? file.mimeType : fallbackType;
  const fileName = file.fileName || fallbackName;

  // Web: blob: and data: URIs must be fetched and appended as real Blob objects.
  if (file.uri.startsWith('blob:') || file.uri.startsWith('data:')) {
    const resp = await fetch(file.uri);
    const blob = await resp.blob();
    formData.append(fieldName, blob, fileName);
  } else {
    // Mobile (React Native): use the { uri, type, name } pattern.
    // RN's native networking module resolves the file:// URI to binary.
    formData.append(fieldName, {
      uri: file.uri,
      type: mimeType,
      name: fileName,
    });
  }
}

/**
 * Appends an array of files to FormData under the same field name.
 *
 * @param {FormData} formData - The FormData instance.
 * @param {string} fieldName - The multipart field name.
 * @param {Array} fileList - Array of file objects from expo-image-picker.
 * @param {object} options - Optional overrides.
 * @param {boolean} options.isVideo - Whether these are video files.
 */
export async function appendFileList(formData, fieldName, fileList, options = {}) {
  if (!Array.isArray(fileList)) return;

  const { isVideo = false } = options;
  const fallbackType = isVideo ? 'video/mp4' : 'image/jpeg';

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i];
    const ext = isVideo ? 'mp4' : 'jpg';
    const fallbackName = isVideo ? `video_${i}.${ext}` : `image_${i}.${ext}`;
    await appendFilePart(formData, fieldName, file, { fallbackName, fallbackType });
  }
}
