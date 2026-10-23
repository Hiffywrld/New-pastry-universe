// The shop and admin talk to the Spring Boot API. The clickable preview
// (built with VITE_MOCK=1) swaps in a pretend in-browser backend instead,
// chosen in vite.config.js so the demo code never ships to the real site.
export { api } from '@api-impl';
export { ApiError } from './http.js';
