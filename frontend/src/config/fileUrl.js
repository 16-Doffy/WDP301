/**
 * Ham tao URL cho file (an hinh, audio, text) tu dataItem cua task.
 * Su dung nhuy bien trong tat ca cac component: ImageAnnotator, ReviewMediaView, AnnotatorTask, ReviewerTask, ...
 */
export function buildFileUrl(dataItem) {
  if (!dataItem) return '';
  const baseUrl = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

  // Lay pathUu da co tren dataItem
  const rawPath = dataItem.path || '';
  const cleanPath = rawPath.replace(/^\/+/, '');

  // Neu co path dau day -> chi can ghep baseUrl phia truoc
  // Path da chua day du duong dan (ke ca filename neu la subtopics)
  if (cleanPath) {
    return baseUrl + '/' + cleanPath;
  }

  // Khong co path -> chi co filename -> uploads/datasets/filename
  if (dataItem.filename) {
    return baseUrl + '/uploads/datasets/' + dataItem.filename;
  }

  return '';
}
