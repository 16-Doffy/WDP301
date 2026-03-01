// API Configuration
// Option 1: API_URL is base host (no trailing slash, no /api)
const API_BASE_URL = (process.env.REACT_APP_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

export const API_URL = API_BASE_URL;
export default API_BASE_URL;
