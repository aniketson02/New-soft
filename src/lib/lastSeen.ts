import AsyncStorage from '@react-native-async-storage/async-storage';

/** Per-user "last opened the board" timestamp, used to build the away-recap. */
const key = (uid: string) => `hearth_last_seen_${uid}`;

export async function getLastSeen(uid: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(key(uid));
  } catch {
    return null;
  }
}

export async function setLastSeen(uid: string, iso: string): Promise<void> {
  try {
    await AsyncStorage.setItem(key(uid), iso);
  } catch {
    // best-effort; a missed write just means no recap next time
  }
}
