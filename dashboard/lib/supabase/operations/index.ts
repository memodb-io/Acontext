/**
 * Supabase operations
 *
 * This module exports all database operations and business logic
 * organized by domain (auth, organizations, projects).
 *
 * Includes: queries, mutations, and other database operations.
 *
 * For Server Components, prefer using cached versions from "./cached"
 * to enable per-request deduplication.
 */

// Auth operations (Server Actions)
export {
  getCurrentUser,
  getCurrentUserOptional,
  signInWithPassword,
  signInWithOAuth,
  signUp,
  signOut,
  resetPasswordForEmail,
  updateUserPassword,
  exchangeCodeForSession,
  verifyOtp,
  getSession,
} from "./auth";

// Organization operations (Server Actions)
export {
  getOrganizationMembership,
  getOrganizationMemberships,
  getOrganizationMembershipForCurrentUser,
  getOrganizationMembershipsForCurrentUser,
  isOrganizationOwner,
  isCurrentUserOrganizationOwner,
  getOrganization,
  updateOrganization,
  deleteOrganization,
  createOrganization,
  getProductPlans,
  getOrganizationMembers,
  addOrganizationMemberByEmail,
  removeOrganizationMember,
  getOrganizationDataWithPlan,
  getOrganizationUsage,
  getAllOrganizationsUsage,
  type OrganizationMember,
  type OrganizationUsageData,
  type OrganizationUsageSummary,
} from "./organizations";

// Project operations (Server Actions)
export {
  getOrganizationProjects,
  getProject,
  updateProject,
  deleteProject,
  createOrganizationProject,
  getSecretKeyRotations,
  createSecretKeyRotation,
  type SecretKeyRotation,
} from "./projects";

// Price operations
export { getPrices, type GetPricesResult, type Product, type PlanDescription, type Price } from "./prices";

// Alert banner operations
export { getAlertBanner, type AlertBannerData } from "./alert-banner";

// Cached operations for Server Components (per-request memoization)
export {
  getCurrentUser as cachedGetCurrentUser,
  getCurrentUserOptional as cachedGetCurrentUserOptional,
  getProject as cachedGetProject,
  getOrganizationProjects as cachedGetOrganizationProjects,
  getOrganization as cachedGetOrganization,
  getOrganizationMembership as cachedGetOrganizationMembership,
  getOrganizationMemberships as cachedGetOrganizationMemberships,
  getOrganizationMembershipForCurrentUser as cachedGetOrganizationMembershipForCurrentUser,
  getOrganizationMembershipsForCurrentUser as cachedGetOrganizationMembershipsForCurrentUser,
  getOrganizationDataWithPlan as cachedGetOrganizationDataWithPlan,
} from "./cached";
