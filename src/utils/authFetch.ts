import { auth } from '../firebase';

/**
 * Wrapper around fetch() that automatically attaches the current Firebase ID Token
 * as an Authorization: Bearer <token> header when a user is signed in.
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers || {});
  const user = auth.currentUser;

  if (user) {
    try {
      const token = await user.getIdToken();
      if (token && !headers.has('Authorization')) {
        headers.set('Authorization', `Bearer ${token}`);
      }
    } catch (err) {
      console.warn('[authFetch] Could not retrieve Firebase ID token:', err);
    }
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
