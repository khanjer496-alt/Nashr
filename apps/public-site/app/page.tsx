import { LandingPage } from '@gitroom/frontend/components/marketing/landing.page';
import { brand } from '@gitroom/nashr-brand/brand.config';

// Homepage only: do not assign the homepage canonical to policy subpages.
export const metadata = { alternates: { canonical: brand.appUrl } };
export default LandingPage;
