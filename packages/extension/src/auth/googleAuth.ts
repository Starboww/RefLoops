// =============================================================================
// RefLoop — Google Auth
// =============================================================================

import { createChromeRepositories } from '@refloop/storage-chrome';
import type { UserAccount } from '@refloop/core';

/**
 * Sign in with Google via chrome.identity.
 */
export async function signIn(): Promise<UserAccount> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: true }, async (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error(chrome.runtime.lastError?.message ?? 'Sign-in failed'));
        return;
      }

      try {
        const response = await fetch(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const userInfo = (await response.json()) as {
          sub: string;
          email: string;
          name?: string;
          picture?: string;
        };

        const account: UserAccount = {
          googleId: userInfo.sub,
          email: userInfo.email,
          displayName: userInfo.name,
          photoUrl: userInfo.picture,
          signedInAt: new Date().toISOString(),
        };

        const { userAccount } = await createChromeRepositories();
        await userAccount.set(account);
        resolve(account);
      } catch (err) {
        reject(err);
      }
    });
  });
}

/**
 * Sign out — revoke token and clear stored account.
 */
export async function signOut(): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token }, async () => {
          try {
            await fetch(`https://accounts.google.com/o/oauth2/revoke?token=${token}`);
          } catch {
            // Best effort
          }
          const { userAccount } = await createChromeRepositories();
          await userAccount.clear();
          resolve();
        });
      } else {
        void (async () => {
          const { userAccount } = await createChromeRepositories();
          await userAccount.clear();
          resolve();
        })();
      }
    });
  });
}

/**
 * Get currently signed-in user from storage.
 */
export async function getUser(): Promise<UserAccount | null> {
  const { userAccount } = await createChromeRepositories();
  return userAccount.get();
}
