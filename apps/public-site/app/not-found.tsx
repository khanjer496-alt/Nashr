import Link from 'next/link';
import { LegalPage } from '@gitroom/frontend/components/legal/legal.page';
export default function NotFound() {
  return <LegalPage title="Page not found" subtitle="This address does not exist."><Link className="underline" href="/">Back to the product preview</Link></LegalPage>;
}
