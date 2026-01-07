import { createClient, Client } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

// Check if Liveblocks is configured
const publicApiKey = process.env.NEXT_PUBLIC_LIVEBLOCKS_PUBLIC_KEY;
export const isLiveblocksConfigured = !!publicApiKey;

// Create the Liveblocks client only if configured
let client: Client;
if (publicApiKey) {
  client = createClient({ publicApiKey });
} else {
  // Create a minimal client that won't crash but won't work for real-time features
  // This is a workaround to allow the app to load without Liveblocks
  client = createClient({
    authEndpoint: "/api/liveblocks-auth",
    // This will fail gracefully when someone tries to join a room
  });
}

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
