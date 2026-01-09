import { createClient, Client } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

// Check if Liveblocks is configured with a valid key
const publicApiKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY || '';
const isValidKey = publicApiKey.startsWith('pk_');
export const isLiveblocksConfigured = isValidKey;

// Debug logging in development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[Liveblocks] Config check:', {
    hasKey: !!publicApiKey,
    keyPrefix: publicApiKey ? publicApiKey.substring(0, 10) + '...' : 'none',
    isValid: isValidKey,
  });
}

// Create the Liveblocks client
// Use auth endpoint for proper user names, fallback to public key if auth fails
const client: Client = createClient({
  authEndpoint: async (room) => {
    try {
      const response = await fetch('/api/liveblocks-auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room }),
      });

      if (!response.ok) {
        // Auth endpoint failed, throw to trigger fallback
        throw new Error(`Auth failed: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.warn('[Liveblocks] Auth endpoint failed, using public key fallback:', error);
      // Return public key auth as fallback
      if (isValidKey) {
        return { token: publicApiKey };
      }
      throw error;
    }
  },
  throttle: 100,
});

// Presence represents the user's current state
type Presence = {
  cursor: { x: number; y: number } | null;
  name: string;
  isTyping: boolean;
};

// Storage represents the shared state
type Storage = {
  draft: string;
};

// User metadata
type UserMeta = {
  id: string;
  info: {
    name: string;
    color: string;
  };
};

// Room event types (if needed)
type RoomEvent = {};

// Thread metadata (if needed)
type ThreadMetadata = {};

// Create the room context with types
const roomContext = createRoomContext<Presence, Storage, UserMeta, RoomEvent, ThreadMetadata>(client);

export const {
  suspense: {
    RoomProvider,
    useRoom,
    useMyPresence,
    useUpdateMyPresence,
    useOthers,
    useOthersMapped,
    useSelf,
    useStorage,
    useMutation,
    useStatus,
  },
} = roomContext;

// Export ClientSideSuspense for wrapping suspense components
export { ClientSideSuspense } from "@liveblocks/react";

// Re-export non-suspense RoomProvider for error handling wrapper
export const { RoomProvider: BaseRoomProvider } = roomContext;
