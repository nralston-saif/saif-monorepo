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

// Create the Liveblocks client using PUBLIC KEY authentication only
// This is the most reliable method - auth endpoint was causing connection failures
// User names for cursors will come from presence (set in RoomProvider)
const client: Client = isValidKey
  ? createClient({
      publicApiKey: publicApiKey,
      throttle: 100,
    })
  : createClient({
      // No valid key - create a dummy client that will fail gracefully
      authEndpoint: async () => {
        throw new Error('Liveblocks not configured');
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
