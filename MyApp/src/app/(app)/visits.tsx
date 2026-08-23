import { Redirect } from 'expo-router';

/** Legacy deep link — visits live on the Field tab. */
export default function VisitsRedirect() {
  return <Redirect href="/(app)/field" />;
}
