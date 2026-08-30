import { ConnectorConfig, DataConnect, QueryRef, QueryPromise, ExecuteQueryOptions } from 'firebase/data-connect';

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

export interface AdvertiserListActivePackagesData {
  adPackages: ({
    code: string;
    durationDays: number;
    tier: string;
    priceMinor: Int64String;
    currency: string;
  } & AdPackage_Key)[];
}

export interface AdvertiserListMyClaimsData {
  donationClaims: ({
    id: UUIDString;
    status: string;
    createdAt: TimestampString;
    rejectionReasonCode?: string | null;
    server: {
      id: UUIDString;
      name: string;
      game: {
        name: string;
        slug: string;
      } & Game_Key;
    } & Server_Key;
    package: {
      code: string;
      durationDays: number;
      tier: string;
    } & AdPackage_Key;
  } & DonationClaim_Key)[];
}

export interface AdvertiserListMyClaimsVariables {
  advertiserUid: string;
}

export interface AdvertiserListMyEligibleServersData {
  servers: ({
    id: UUIDString;
    name: string;
    website: string;
    game: {
      slug: string;
      name: string;
    } & Game_Key;
  } & Server_Key)[];
}

export interface AdvertiserListMyEligibleServersVariables {
  ownerUid: string;
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

interface AdvertiserListMyEligibleServersRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdvertiserListMyEligibleServersVariables): QueryRef<AdvertiserListMyEligibleServersData, AdvertiserListMyEligibleServersVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdvertiserListMyEligibleServersVariables): QueryRef<AdvertiserListMyEligibleServersData, AdvertiserListMyEligibleServersVariables>;
  operationName: string;
}
export const advertiserListMyEligibleServersRef: AdvertiserListMyEligibleServersRef;

export function advertiserListMyEligibleServers(vars: AdvertiserListMyEligibleServersVariables, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListMyEligibleServersData, AdvertiserListMyEligibleServersVariables>;
export function advertiserListMyEligibleServers(dc: DataConnect, vars: AdvertiserListMyEligibleServersVariables, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListMyEligibleServersData, AdvertiserListMyEligibleServersVariables>;

interface AdvertiserListActivePackagesRef {
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdvertiserListActivePackagesData, undefined>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect): QueryRef<AdvertiserListActivePackagesData, undefined>;
  operationName: string;
}
export const advertiserListActivePackagesRef: AdvertiserListActivePackagesRef;

export function advertiserListActivePackages(options?: ExecuteQueryOptions): QueryPromise<AdvertiserListActivePackagesData, undefined>;
export function advertiserListActivePackages(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListActivePackagesData, undefined>;

interface AdvertiserListMyClaimsRef {
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdvertiserListMyClaimsVariables): QueryRef<AdvertiserListMyClaimsData, AdvertiserListMyClaimsVariables>;
  /* Allow users to pass in custom DataConnect instances */
  (dc: DataConnect, vars: AdvertiserListMyClaimsVariables): QueryRef<AdvertiserListMyClaimsData, AdvertiserListMyClaimsVariables>;
  operationName: string;
}
export const advertiserListMyClaimsRef: AdvertiserListMyClaimsRef;

export function advertiserListMyClaims(vars: AdvertiserListMyClaimsVariables, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListMyClaimsData, AdvertiserListMyClaimsVariables>;
export function advertiserListMyClaims(dc: DataConnect, vars: AdvertiserListMyClaimsVariables, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListMyClaimsData, AdvertiserListMyClaimsVariables>;

