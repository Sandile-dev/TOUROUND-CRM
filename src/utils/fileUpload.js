import { Platform } from 'react-native';

/**
 * Shared helper for multipart uploads that work on both web and native.
 *
 * IMPORTANT (Expo SDK 54+): the global `fetch` is polyfilled by Expo's winter
 * runtime, whose FormData converter does NOT support React Native's
 * `{ uri, type, name }` file part — it throws "Unsupported FormDataPart
 * implementation". So on native we must send multipart via XMLHttpRequest,
 * which uses React Native's native FormData (that DOES support file URIs).
 * On web we use fetch + real Blob objects.
 */

const isWeb = Platform.OS === 'web';

/**
 * Appends a single picked file to FormData using the correct shape per platform.
 *
 * @param {FormData} formData
 * @param {string} fieldName
 * @param {object} file - expo-image-picker asset ({ uri, mimeType?, fileName?, type? })
 * @param {object} options - { fallbackName, fallbackType }
 */
export async function appendFilePart(formData, fieldName, file, options = {}) {
  if (!file || !file.uri) return;

  const { fallbackName = 'file.jpg', fallbackType = 'image/jpeg' } = options;
  const mimeType = (file.mimeType && file.mimeType.includes('/')) ? file.mimeType : fallbackType;
  const fileName = file.fileName || fallbackName;

  if (isWeb) {
    // Web: fetch the (blob:/data:/http) URI and append a real Blob.
    const resp = await fetch(file.uri);
    const blob = await resp.blob();
    formData.append(fieldName, blob, fileName);
  } else {
    // Native: RN's FormData accepts a { uri, type, name } file descriptor.
    formData.append(fieldName, {
      uri: file.uri,
      type: mimeType,
      name: fileName,
    });
  }
}

/**
 * Appends an array of picked files to FormData under one field name.
 *
 * @param {FormData} formData
 * @param {string} fieldName
 * @param {Array} fileList
 * @param {object} options - { isVideo }
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

/**
 * Sends a multipart FormData request, choosing the transport that supports the
 * FormData parts for the current platform:
 *   - native: XMLHttpRequest (RN native FormData; supports { uri, type, name })
 *   - web:    fetch (supports Blob parts)
 *
 * @param {string} method - e.g. 'POST' | 'PUT'
 * @param {string} url - absolute URL
 * @param {FormData} formData
 * @param {object} options - { token }
 * @returns {Promise<any>} parsed JSON or text response
 */
export function sendFormData(method, url, formData, { token } = {}) {
  if (isWeb) {
    return sendViaFetch(method, url, formData, token);
  }
  return sendViaXhr(method, url, formData, token);
}

function sendViaXhr(method, url, formData, token) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    // Do NOT set Content-Type — RN adds the multipart boundary automatically.

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)); }
        catch { resolve(xhr.responseText); }
      } else {
        reject(new Error(xhr.responseText || `Request failed with status ${xhr.status}`));
      }
    };
    xhr.onerror = () => reject(new Error('Network request failed'));
    xhr.send(formData);
  });
}

async function sendViaFetch(method, url, formData, token) {
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { method, headers, body: formData });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(responseText || `Request failed with status ${response.status}`);
  }

  try { return JSON.parse(responseText); }
  catch { return responseText; }
}
