import { Linking, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { track } from './analytics';

/**
 * One-tap join: invite links look like <app-url>/?join=<code>. The code is
 * captured on launch and persisted so it survives the email OTP sign-in
 * (and any page reload on web), then consumed by the family-setup screen.
 */

const KEY = 'hearth_pending_invite';

export const APP_URL = 'https://aniketson02.github.io/New-soft/app/';

export function inviteUrl(code: string): string {
  return `${APP_URL}?join=${encodeURIComponent(code)}`;
}

export async function captureInviteFromUrl(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL();
    if (url) {
      const code = new URL(url).searchParams.get('join');
      if (code && /^[a-z0-9-]{4,32}$/i.test(code.trim())) {
        await AsyncStorage.setItem(KEY, code.trim().toLowerCase());
        track('invite_link_opened');
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
          // drop the query so refreshes don't re-fire the invite flow
          window.history.replaceState(null, '', window.location.pathname);
        }
      }
    }
  } catch {
    // bad URL — fall through to whatever is already stored
  }
  return AsyncStorage.getItem(KEY);
}

export function clearPendingInvite(): void {
  AsyncStorage.removeItem(KEY).catch(() => {});
}
