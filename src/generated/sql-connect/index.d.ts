import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions, MutationRef, MutationPromise } from 'firebase/data-connect';

export const connectorConfig: ConnectorConfig;

export type TimestampString = string;
export type UUIDString = string;
export type Int64String = string;
export type DateString = string;




export interface AdImpression_Key {
  id: UUIDString;
  __typename?: 'AdImpression_Key';
}

export interface AdModerationEvent_Key {
  id: UUIDString;
  __typename?: 'AdModerationEvent_Key';
}

export interface AdPackage_Key {
  code: string;
  __typename?: 'AdPackage_Key';
}

export interface AdminApproveSubmissionData {
  serverSubmission_update?: ServerSubmission_Key | null;
  moderationEvent_insert: ModerationEvent_Key;
}

export interface AdminApproveSubmissionVariables {
  id: UUIDString;
}

export interface AdminListPendingDonationClaimsData {
  donationClaims: ({
    id: UUIDString;
    advertiserUid: string;
    donorReference: string;
    createdAt: TimestampString;
    server: {
      id: UUIDString;
      name: string;
      website: string;
      game: {
        name: string;
        slug: string;
      } & Game_Key;
    } & Server_Key;
    package: {
      code: string;
      durationDays: number;
      tier: string;
      priceMinor: Int64String;
      currency: string;
    } & AdPackage_Key;
  } & DonationClaim_Key)[];
}

export interface AdminListPendingSubmissionsData {
  serverSubmissions: ({
    id: UUIDString;
    name: string;
    website: string;
    gameVersion: string;
    gameSlug: string;
    region: string;
    mode: string;
    description: string;
    submittedAt: TimestampString;
    status: string;
  } & ServerSubmission_Key)[];
}

export interface AdminRejectDonationClaimData {
  donationClaim_update?: DonationClaim_Key | null;
  donationReviewEvent_insert: DonationReviewEvent_Key;
}

export interface AdminRejectDonationClaimVariables {
  id: UUIDString;
  reasonCode: string;
}

export interface AdminRejectSubmissionData {
  serverSubmission_update?: ServerSubmission_Key | null;
  moderationEvent_insert: ModerationEvent_Key;
}

export interface AdminRejectSubmissionVariables {
  id: UUIDString;
}

export interface AdminVerifyDonationClaimData {
  donationClaim_update?: DonationClaim_Key | null;
  donationReviewEvent_insert: DonationReviewEvent_Key;
}

export interface AdminVerifyDonationClaimVariables {
  id: UUIDString;
  verifiedAmountMinor: Int64String;
  verifiedCurrency: string;
}

export interface BannerAsset_Key {
  id: UUIDString;
  __typename?: 'BannerAsset_Key';
}

export interface DonationClaim_Key {
  id: UUIDString;
  __typename?: 'DonationClaim_Key';
}

export interface DonationReviewEvent_Key {
  id: UUIDString;
  __typename?: 'DonationReviewEvent_Key';
}

export interface ExclusivePlacement_Key {
  id: UUIDString;
  __typename?: 'ExclusivePlacement_Key';
}

export interface Game_Key {
  slug: string;
  __typename?: 'Game_Key';
}

export interface ModerationEvent_Key {
  id: UUIDString;
  __typename?: 'ModerationEvent_Key';
}

export interface ServerSubmission_Key {
  id: UUIDString;
  __typename?: 'ServerSubmission_Key';
}

export interface Server_Key {
  id: UUIDString;
  __typename?: 'Server_Key';
}

interface AdminListPendingSubmissionsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminListPendingSubmissionsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdminListPendingSubmissionsData, undefined>;
  operationName: string;
}
export const adminListPendingSubmissionsRef: AdminListPendingSubmissionsRef;

export function adminListPendingSubmissions(options?: ExecuteQueryOptions): QueryPromise<AdminListPendingSubmissionsData, undefined>;
export function adminListPendingSubmissions(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminListPendingSubmissionsData, undefined>;

interface AdminApproveSubmissionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminApproveSubmissionVariables): MutationRef<AdminApproveSubmissionData, AdminApproveSubmissionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminApproveSubmissionVariables): MutationRef<AdminApproveSubmissionData, AdminApproveSubmissionVariables>;
  operationName: string;
}
export const adminApproveSubmissionRef: AdminApproveSubmissionRef;

export function adminApproveSubmission(vars: AdminApproveSubmissionVariables): MutationPromise<AdminApproveSubmissionData, AdminApproveSubmissionVariables>;
export function adminApproveSubmission(dc: DataConnect, vars: AdminApproveSubmissionVariables): MutationPromise<AdminApproveSubmissionData, AdminApproveSubmissionVariables>;

interface AdminRejectSubmissionRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminRejectSubmissionVariables): MutationRef<AdminRejectSubmissionData, AdminRejectSubmissionVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminRejectSubmissionVariables): MutationRef<AdminRejectSubmissionData, AdminRejectSubmissionVariables>;
  operationName: string;
}
export const adminRejectSubmissionRef: AdminRejectSubmissionRef;

export function adminRejectSubmission(vars: AdminRejectSubmissionVariables): MutationPromise<AdminRejectSubmissionData, AdminRejectSubmissionVariables>;
export function adminRejectSubmission(dc: DataConnect, vars: AdminRejectSubmissionVariables): MutationPromise<AdminRejectSubmissionData, AdminRejectSubmissionVariables>;

interface AdminListPendingDonationClaimsRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminListPendingDonationClaimsData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdminListPendingDonationClaimsData, undefined>;
  operationName: string;
}
export const adminListPendingDonationClaimsRef: AdminListPendingDonationClaimsRef;

export function adminListPendingDonationClaims(options?: ExecuteQueryOptions): QueryPromise<AdminListPendingDonationClaimsData, undefined>;
export function adminListPendingDonationClaims(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminListPendingDonationClaimsData, undefined>;

interface AdminVerifyDonationClaimRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminVerifyDonationClaimVariables): MutationRef<AdminVerifyDonationClaimData, AdminVerifyDonationClaimVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminVerifyDonationClaimVariables): MutationRef<AdminVerifyDonationClaimData, AdminVerifyDonationClaimVariables>;
  operationName: string;
}
export const adminVerifyDonationClaimRef: AdminVerifyDonationClaimRef;

export function adminVerifyDonationClaim(vars: AdminVerifyDonationClaimVariables): MutationPromise<AdminVerifyDonationClaimData, AdminVerifyDonationClaimVariables>;
export function adminVerifyDonationClaim(dc: DataConnect, vars: AdminVerifyDonationClaimVariables): MutationPromise<AdminVerifyDonationClaimData, AdminVerifyDonationClaimVariables>;

interface AdminRejectDonationClaimRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminRejectDonationClaimVariables): MutationRef<AdminRejectDonationClaimData, AdminRejectDonationClaimVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdminRejectDonationClaimVariables): MutationRef<AdminRejectDonationClaimData, AdminRejectDonationClaimVariables>;
  operationName: string;
}
export const adminRejectDonationClaimRef: AdminRejectDonationClaimRef;

export function adminRejectDonationClaim(vars: AdminRejectDonationClaimVariables): MutationPromise<AdminRejectDonationClaimData, AdminRejectDonationClaimVariables>;
export function adminRejectDonationClaim(dc: DataConnect, vars: AdminRejectDonationClaimVariables): MutationPromise<AdminRejectDonationClaimData, AdminRejectDonationClaimVariables>;

