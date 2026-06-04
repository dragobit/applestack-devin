import { useMemo } from "react";
import { createHead, UnheadProvider } from "@unhead/react/client";
import { BrowserRouter } from "react-router-dom";
import {
  EventStoreProvider,
  AccountsProvider,
  ActionsProvider,
} from "applesauce-react/providers";
import { EventStore } from "applesauce-core";
import { AccountManager, Accounts } from "applesauce-accounts";
import { ActionRunner } from "applesauce-actions";

interface TestAppProps {
  children: React.ReactNode;
}

export function TestApp({ children }: TestAppProps) {
  const head = createHead();

  // Create isolated test instances
  const eventStore = useMemo(() => new EventStore(), []);
  const accountManager = useMemo(() => {
    const manager = new AccountManager();
    Accounts.registerCommonAccountTypes(manager);
    return manager;
  }, []);

  const runner = useMemo(
    () =>
      new ActionRunner(eventStore, accountManager.signer, async (event) => {
        eventStore.add(event);
      }),
    [eventStore, accountManager],
  );

  return (
    <UnheadProvider head={head}>
      <EventStoreProvider eventStore={eventStore}>
        <AccountsProvider manager={accountManager}>
          <ActionsProvider runner={runner}>
            <BrowserRouter>{children}</BrowserRouter>
          </ActionsProvider>
        </AccountsProvider>
      </EventStoreProvider>
    </UnheadProvider>
  );
}

export default TestApp;
