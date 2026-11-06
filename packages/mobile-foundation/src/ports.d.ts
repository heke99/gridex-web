/** Provider-neutral contracts. Implementations belong in the app/server adapters. */
export type AuthenticatedSession = Readonly<{
  accessToken: string;
  expiresAt: number;
}>;

export interface IdentityProvider {
  signIn(email: string, password: string): Promise<AuthenticatedSession>;
  refresh(): Promise<AuthenticatedSession | null>;
  signOut(): Promise<void>;
}

/** All customer requests go to a trusted app server; never embed an OPS key. */
export interface CustomerPortalGateway<TOverview> {
  getOverview(session: AuthenticatedSession, signal?: AbortSignal): Promise<TOverview>;
}

/** Server-only verified binding, derived from trusted configuration and Auth. */
export type VerifiedCustomerBinding = Readonly<{
  tenantId: string;
  subject: string;
  customerReference: string;
}>;

/** Server-only persistence boundary. Production implementation uses existing Gridex storage. */
export interface CustomerBindingRepository {
  findActiveBinding(issuer: string, subject: string): Promise<VerifiedCustomerBinding | null>;
}
