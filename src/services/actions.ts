import { ActionRunner, Actions } from "applesauce-actions";
import { eventStore, publish } from "./nostr";
import { accounts } from "./accounts";

/**
 * Global ActionRunner instance for executing pre-built Nostr actions.
 * Examples: UpdateProfile, FollowUser, AddOutboxRelay, etc.
 *
 * Usage:
 * ```ts
 * import { runner, Actions } from '@/services/actions';
 *
 * await runner.run(Actions.UpdateProfile, { name: 'Alice' });
 * ```
 */
export const runner = new ActionRunner(eventStore, accounts.signer, publish);

// Export Actions for convenience
export { Actions };
