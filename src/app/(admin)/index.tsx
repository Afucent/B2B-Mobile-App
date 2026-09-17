import { Redirect } from 'expo-router';

/** Admin modules are surfaced in bottom tabs; legacy route redirects home. */
export default function AdminHubRedirect() {
  return <Redirect href="/(app)" />;
}
