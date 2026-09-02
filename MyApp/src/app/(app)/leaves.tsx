import { Redirect } from 'expo-router';

/** Legacy tab route — leave management opens from Clock tab. */
export default function LeavesTabRedirect() {
  return <Redirect href="/leave-management" />;
}
