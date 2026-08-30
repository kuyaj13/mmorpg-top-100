# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `admin`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*AdminListPendingSubmissions*](#adminlistpendingsubmissions)
  - [*AdminListPendingDonationClaims*](#adminlistpendingdonationclaims)
- [**Mutations**](#mutations)
  - [*AdminApproveSubmission*](#adminapprovesubmission)
  - [*AdminRejectSubmission*](#adminrejectsubmission)
  - [*AdminVerifyDonationClaim*](#adminverifydonationclaim)
  - [*AdminRejectDonationClaim*](#adminrejectdonationclaim)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `admin`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@mmorpg-top-100/admin-connector` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@mmorpg-top-100/admin-connector';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@mmorpg-top-100/admin-connector';

const dataConnect = getDataConnect(connectorConfig);
connectDataConnectEmulator(dataConnect, 'localhost', 9399);
```

After it's initialized, you can call your Data Connect [queries](#queries) and [mutations](#mutations) from your generated SDK.

# Queries

There are two ways to execute a Data Connect Query using the generated Web SDK:
- Using a Query Reference function, which returns a `QueryRef`
  - The `QueryRef` can be used as an argument to `executeQuery()`, which will execute the Query and return a `QueryPromise`
- Using an action shortcut function, which returns a `QueryPromise`
  - Calling the action shortcut function will execute the Query and return a `QueryPromise`

The following is true for both the action shortcut function and the `QueryRef` function:
- The `QueryPromise` returned will resolve to the result of the Query once it has finished executing
- If the Query accepts arguments, both the action shortcut function and the `QueryRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Query
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `admin` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## AdminListPendingSubmissions
You can execute the `AdminListPendingSubmissions` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [sql-connect/index.d.ts](./index.d.ts):
```typescript
adminListPendingSubmissions(options?: ExecuteQueryOptions): QueryPromise<AdminListPendingSubmissionsData, undefined>;

interface AdminListPendingSubmissionsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminListPendingSubmissionsData, undefined>;
}
export const adminListPendingSubmissionsRef: AdminListPendingSubmissionsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminListPendingSubmissions(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminListPendingSubmissionsData, undefined>;

interface AdminListPendingSubmissionsRef {
  ...
  (dc: DataConnect): QueryRef<AdminListPendingSubmissionsData, undefined>;
}
export const adminListPendingSubmissionsRef: AdminListPendingSubmissionsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminListPendingSubmissionsRef:
```typescript
const name = adminListPendingSubmissionsRef.operationName;
console.log(name);
```

### Variables
The `AdminListPendingSubmissions` query has no variables.
### Return Type
Recall that executing the `AdminListPendingSubmissions` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminListPendingSubmissionsData`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminListPendingSubmissions`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminListPendingSubmissions } from '@mmorpg-top-100/admin-connector';


// Call the `adminListPendingSubmissions()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminListPendingSubmissions();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminListPendingSubmissions(dataConnect);

console.log(data.serverSubmissions);

// Or, you can use the `Promise` API.
adminListPendingSubmissions().then((response) => {
  const data = response.data;
  console.log(data.serverSubmissions);
});
```

### Using `AdminListPendingSubmissions`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminListPendingSubmissionsRef } from '@mmorpg-top-100/admin-connector';


// Call the `adminListPendingSubmissionsRef()` function to get a reference to the query.
const ref = adminListPendingSubmissionsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminListPendingSubmissionsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.serverSubmissions);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.serverSubmissions);
});
```

## AdminListPendingDonationClaims
You can execute the `AdminListPendingDonationClaims` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [sql-connect/index.d.ts](./index.d.ts):
```typescript
adminListPendingDonationClaims(options?: ExecuteQueryOptions): QueryPromise<AdminListPendingDonationClaimsData, undefined>;

interface AdminListPendingDonationClaimsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdminListPendingDonationClaimsData, undefined>;
}
export const adminListPendingDonationClaimsRef: AdminListPendingDonationClaimsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
adminListPendingDonationClaims(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdminListPendingDonationClaimsData, undefined>;

interface AdminListPendingDonationClaimsRef {
  ...
  (dc: DataConnect): QueryRef<AdminListPendingDonationClaimsData, undefined>;
}
export const adminListPendingDonationClaimsRef: AdminListPendingDonationClaimsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminListPendingDonationClaimsRef:
```typescript
const name = adminListPendingDonationClaimsRef.operationName;
console.log(name);
```

### Variables
The `AdminListPendingDonationClaims` query has no variables.
### Return Type
Recall that executing the `AdminListPendingDonationClaims` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminListPendingDonationClaimsData`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdminListPendingDonationClaims`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminListPendingDonationClaims } from '@mmorpg-top-100/admin-connector';


// Call the `adminListPendingDonationClaims()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminListPendingDonationClaims();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminListPendingDonationClaims(dataConnect);

console.log(data.donationClaims);

// Or, you can use the `Promise` API.
adminListPendingDonationClaims().then((response) => {
  const data = response.data;
  console.log(data.donationClaims);
});
```

### Using `AdminListPendingDonationClaims`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, adminListPendingDonationClaimsRef } from '@mmorpg-top-100/admin-connector';


// Call the `adminListPendingDonationClaimsRef()` function to get a reference to the query.
const ref = adminListPendingDonationClaimsRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminListPendingDonationClaimsRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.donationClaims);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.donationClaims);
});
```

# Mutations

There are two ways to execute a Data Connect Mutation using the generated Web SDK:
- Using a Mutation Reference function, which returns a `MutationRef`
  - The `MutationRef` can be used as an argument to `executeMutation()`, which will execute the Mutation and return a `MutationPromise`
- Using an action shortcut function, which returns a `MutationPromise`
  - Calling the action shortcut function will execute the Mutation and return a `MutationPromise`

The following is true for both the action shortcut function and the `MutationRef` function:
- The `MutationPromise` returned will resolve to the result of the Mutation once it has finished executing
- If the Mutation accepts arguments, both the action shortcut function and the `MutationRef` function accept a single argument: an object that contains all the required variables (and the optional variables) for the Mutation
- Both functions can be called with or without passing in a `DataConnect` instance as an argument. If no `DataConnect` argument is passed in, then the generated SDK will call `getDataConnect(connectorConfig)` behind the scenes for you.

Below are examples of how to use the `admin` connector's generated functions to execute each mutation. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

## AdminApproveSubmission
You can execute the `AdminApproveSubmission` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [sql-connect/index.d.ts](./index.d.ts):
```typescript
adminApproveSubmission(vars: AdminApproveSubmissionVariables): MutationPromise<AdminApproveSubmissionData, AdminApproveSubmissionVariables>;

interface AdminApproveSubmissionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminApproveSubmissionVariables): MutationRef<AdminApproveSubmissionData, AdminApproveSubmissionVariables>;
}
export const adminApproveSubmissionRef: AdminApproveSubmissionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminApproveSubmission(dc: DataConnect, vars: AdminApproveSubmissionVariables): MutationPromise<AdminApproveSubmissionData, AdminApproveSubmissionVariables>;

interface AdminApproveSubmissionRef {
  ...
  (dc: DataConnect, vars: AdminApproveSubmissionVariables): MutationRef<AdminApproveSubmissionData, AdminApproveSubmissionVariables>;
}
export const adminApproveSubmissionRef: AdminApproveSubmissionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminApproveSubmissionRef:
```typescript
const name = adminApproveSubmissionRef.operationName;
console.log(name);
```

### Variables
The `AdminApproveSubmission` mutation requires an argument of type `AdminApproveSubmissionVariables`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminApproveSubmissionVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `AdminApproveSubmission` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminApproveSubmissionData`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminApproveSubmissionData {
  serverSubmission_update?: ServerSubmission_Key | null;
  moderationEvent_insert: ModerationEvent_Key;
}
```
### Using `AdminApproveSubmission`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminApproveSubmission, AdminApproveSubmissionVariables } from '@mmorpg-top-100/admin-connector';

// The `AdminApproveSubmission` mutation requires an argument of type `AdminApproveSubmissionVariables`:
const adminApproveSubmissionVars: AdminApproveSubmissionVariables = {
  id: ..., 
};

// Call the `adminApproveSubmission()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminApproveSubmission(adminApproveSubmissionVars);
// Variables can be defined inline as well.
const { data } = await adminApproveSubmission({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminApproveSubmission(dataConnect, adminApproveSubmissionVars);

console.log(data.serverSubmission_update);
console.log(data.moderationEvent_insert);

// Or, you can use the `Promise` API.
adminApproveSubmission(adminApproveSubmissionVars).then((response) => {
  const data = response.data;
  console.log(data.serverSubmission_update);
  console.log(data.moderationEvent_insert);
});
```

### Using `AdminApproveSubmission`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminApproveSubmissionRef, AdminApproveSubmissionVariables } from '@mmorpg-top-100/admin-connector';

// The `AdminApproveSubmission` mutation requires an argument of type `AdminApproveSubmissionVariables`:
const adminApproveSubmissionVars: AdminApproveSubmissionVariables = {
  id: ..., 
};

// Call the `adminApproveSubmissionRef()` function to get a reference to the mutation.
const ref = adminApproveSubmissionRef(adminApproveSubmissionVars);
// Variables can be defined inline as well.
const ref = adminApproveSubmissionRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminApproveSubmissionRef(dataConnect, adminApproveSubmissionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.serverSubmission_update);
console.log(data.moderationEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.serverSubmission_update);
  console.log(data.moderationEvent_insert);
});
```

## AdminRejectSubmission
You can execute the `AdminRejectSubmission` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [sql-connect/index.d.ts](./index.d.ts):
```typescript
adminRejectSubmission(vars: AdminRejectSubmissionVariables): MutationPromise<AdminRejectSubmissionData, AdminRejectSubmissionVariables>;

interface AdminRejectSubmissionRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminRejectSubmissionVariables): MutationRef<AdminRejectSubmissionData, AdminRejectSubmissionVariables>;
}
export const adminRejectSubmissionRef: AdminRejectSubmissionRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminRejectSubmission(dc: DataConnect, vars: AdminRejectSubmissionVariables): MutationPromise<AdminRejectSubmissionData, AdminRejectSubmissionVariables>;

interface AdminRejectSubmissionRef {
  ...
  (dc: DataConnect, vars: AdminRejectSubmissionVariables): MutationRef<AdminRejectSubmissionData, AdminRejectSubmissionVariables>;
}
export const adminRejectSubmissionRef: AdminRejectSubmissionRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminRejectSubmissionRef:
```typescript
const name = adminRejectSubmissionRef.operationName;
console.log(name);
```

### Variables
The `AdminRejectSubmission` mutation requires an argument of type `AdminRejectSubmissionVariables`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminRejectSubmissionVariables {
  id: UUIDString;
}
```
### Return Type
Recall that executing the `AdminRejectSubmission` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminRejectSubmissionData`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminRejectSubmissionData {
  serverSubmission_update?: ServerSubmission_Key | null;
  moderationEvent_insert: ModerationEvent_Key;
}
```
### Using `AdminRejectSubmission`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminRejectSubmission, AdminRejectSubmissionVariables } from '@mmorpg-top-100/admin-connector';

// The `AdminRejectSubmission` mutation requires an argument of type `AdminRejectSubmissionVariables`:
const adminRejectSubmissionVars: AdminRejectSubmissionVariables = {
  id: ..., 
};

// Call the `adminRejectSubmission()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminRejectSubmission(adminRejectSubmissionVars);
// Variables can be defined inline as well.
const { data } = await adminRejectSubmission({ id: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminRejectSubmission(dataConnect, adminRejectSubmissionVars);

console.log(data.serverSubmission_update);
console.log(data.moderationEvent_insert);

// Or, you can use the `Promise` API.
adminRejectSubmission(adminRejectSubmissionVars).then((response) => {
  const data = response.data;
  console.log(data.serverSubmission_update);
  console.log(data.moderationEvent_insert);
});
```

### Using `AdminRejectSubmission`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminRejectSubmissionRef, AdminRejectSubmissionVariables } from '@mmorpg-top-100/admin-connector';

// The `AdminRejectSubmission` mutation requires an argument of type `AdminRejectSubmissionVariables`:
const adminRejectSubmissionVars: AdminRejectSubmissionVariables = {
  id: ..., 
};

// Call the `adminRejectSubmissionRef()` function to get a reference to the mutation.
const ref = adminRejectSubmissionRef(adminRejectSubmissionVars);
// Variables can be defined inline as well.
const ref = adminRejectSubmissionRef({ id: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminRejectSubmissionRef(dataConnect, adminRejectSubmissionVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.serverSubmission_update);
console.log(data.moderationEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.serverSubmission_update);
  console.log(data.moderationEvent_insert);
});
```

## AdminVerifyDonationClaim
You can execute the `AdminVerifyDonationClaim` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [sql-connect/index.d.ts](./index.d.ts):
```typescript
adminVerifyDonationClaim(vars: AdminVerifyDonationClaimVariables): MutationPromise<AdminVerifyDonationClaimData, AdminVerifyDonationClaimVariables>;

interface AdminVerifyDonationClaimRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminVerifyDonationClaimVariables): MutationRef<AdminVerifyDonationClaimData, AdminVerifyDonationClaimVariables>;
}
export const adminVerifyDonationClaimRef: AdminVerifyDonationClaimRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminVerifyDonationClaim(dc: DataConnect, vars: AdminVerifyDonationClaimVariables): MutationPromise<AdminVerifyDonationClaimData, AdminVerifyDonationClaimVariables>;

interface AdminVerifyDonationClaimRef {
  ...
  (dc: DataConnect, vars: AdminVerifyDonationClaimVariables): MutationRef<AdminVerifyDonationClaimData, AdminVerifyDonationClaimVariables>;
}
export const adminVerifyDonationClaimRef: AdminVerifyDonationClaimRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminVerifyDonationClaimRef:
```typescript
const name = adminVerifyDonationClaimRef.operationName;
console.log(name);
```

### Variables
The `AdminVerifyDonationClaim` mutation requires an argument of type `AdminVerifyDonationClaimVariables`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminVerifyDonationClaimVariables {
  id: UUIDString;
  verifiedAmountMinor: Int64String;
  verifiedCurrency: string;
}
```
### Return Type
Recall that executing the `AdminVerifyDonationClaim` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminVerifyDonationClaimData`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminVerifyDonationClaimData {
  donationClaim_update?: DonationClaim_Key | null;
  donationReviewEvent_insert: DonationReviewEvent_Key;
}
```
### Using `AdminVerifyDonationClaim`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminVerifyDonationClaim, AdminVerifyDonationClaimVariables } from '@mmorpg-top-100/admin-connector';

// The `AdminVerifyDonationClaim` mutation requires an argument of type `AdminVerifyDonationClaimVariables`:
const adminVerifyDonationClaimVars: AdminVerifyDonationClaimVariables = {
  id: ..., 
  verifiedAmountMinor: ..., 
  verifiedCurrency: ..., 
};

// Call the `adminVerifyDonationClaim()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminVerifyDonationClaim(adminVerifyDonationClaimVars);
// Variables can be defined inline as well.
const { data } = await adminVerifyDonationClaim({ id: ..., verifiedAmountMinor: ..., verifiedCurrency: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminVerifyDonationClaim(dataConnect, adminVerifyDonationClaimVars);

console.log(data.donationClaim_update);
console.log(data.donationReviewEvent_insert);

// Or, you can use the `Promise` API.
adminVerifyDonationClaim(adminVerifyDonationClaimVars).then((response) => {
  const data = response.data;
  console.log(data.donationClaim_update);
  console.log(data.donationReviewEvent_insert);
});
```

### Using `AdminVerifyDonationClaim`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminVerifyDonationClaimRef, AdminVerifyDonationClaimVariables } from '@mmorpg-top-100/admin-connector';

// The `AdminVerifyDonationClaim` mutation requires an argument of type `AdminVerifyDonationClaimVariables`:
const adminVerifyDonationClaimVars: AdminVerifyDonationClaimVariables = {
  id: ..., 
  verifiedAmountMinor: ..., 
  verifiedCurrency: ..., 
};

// Call the `adminVerifyDonationClaimRef()` function to get a reference to the mutation.
const ref = adminVerifyDonationClaimRef(adminVerifyDonationClaimVars);
// Variables can be defined inline as well.
const ref = adminVerifyDonationClaimRef({ id: ..., verifiedAmountMinor: ..., verifiedCurrency: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminVerifyDonationClaimRef(dataConnect, adminVerifyDonationClaimVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.donationClaim_update);
console.log(data.donationReviewEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.donationClaim_update);
  console.log(data.donationReviewEvent_insert);
});
```

## AdminRejectDonationClaim
You can execute the `AdminRejectDonationClaim` mutation using the following action shortcut function, or by calling `executeMutation()` after calling the following `MutationRef` function, both of which are defined in [sql-connect/index.d.ts](./index.d.ts):
```typescript
adminRejectDonationClaim(vars: AdminRejectDonationClaimVariables): MutationPromise<AdminRejectDonationClaimData, AdminRejectDonationClaimVariables>;

interface AdminRejectDonationClaimRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdminRejectDonationClaimVariables): MutationRef<AdminRejectDonationClaimData, AdminRejectDonationClaimVariables>;
}
export const adminRejectDonationClaimRef: AdminRejectDonationClaimRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `MutationRef` function.
```typescript
adminRejectDonationClaim(dc: DataConnect, vars: AdminRejectDonationClaimVariables): MutationPromise<AdminRejectDonationClaimData, AdminRejectDonationClaimVariables>;

interface AdminRejectDonationClaimRef {
  ...
  (dc: DataConnect, vars: AdminRejectDonationClaimVariables): MutationRef<AdminRejectDonationClaimData, AdminRejectDonationClaimVariables>;
}
export const adminRejectDonationClaimRef: AdminRejectDonationClaimRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the adminRejectDonationClaimRef:
```typescript
const name = adminRejectDonationClaimRef.operationName;
console.log(name);
```

### Variables
The `AdminRejectDonationClaim` mutation requires an argument of type `AdminRejectDonationClaimVariables`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdminRejectDonationClaimVariables {
  id: UUIDString;
  reasonCode: string;
}
```
### Return Type
Recall that executing the `AdminRejectDonationClaim` mutation returns a `MutationPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdminRejectDonationClaimData`, which is defined in [sql-connect/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdminRejectDonationClaimData {
  donationClaim_update?: DonationClaim_Key | null;
  donationReviewEvent_insert: DonationReviewEvent_Key;
}
```
### Using `AdminRejectDonationClaim`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, adminRejectDonationClaim, AdminRejectDonationClaimVariables } from '@mmorpg-top-100/admin-connector';

// The `AdminRejectDonationClaim` mutation requires an argument of type `AdminRejectDonationClaimVariables`:
const adminRejectDonationClaimVars: AdminRejectDonationClaimVariables = {
  id: ..., 
  reasonCode: ..., 
};

// Call the `adminRejectDonationClaim()` function to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await adminRejectDonationClaim(adminRejectDonationClaimVars);
// Variables can be defined inline as well.
const { data } = await adminRejectDonationClaim({ id: ..., reasonCode: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await adminRejectDonationClaim(dataConnect, adminRejectDonationClaimVars);

console.log(data.donationClaim_update);
console.log(data.donationReviewEvent_insert);

// Or, you can use the `Promise` API.
adminRejectDonationClaim(adminRejectDonationClaimVars).then((response) => {
  const data = response.data;
  console.log(data.donationClaim_update);
  console.log(data.donationReviewEvent_insert);
});
```

### Using `AdminRejectDonationClaim`'s `MutationRef` function

```typescript
import { getDataConnect, executeMutation } from 'firebase/data-connect';
import { connectorConfig, adminRejectDonationClaimRef, AdminRejectDonationClaimVariables } from '@mmorpg-top-100/admin-connector';

// The `AdminRejectDonationClaim` mutation requires an argument of type `AdminRejectDonationClaimVariables`:
const adminRejectDonationClaimVars: AdminRejectDonationClaimVariables = {
  id: ..., 
  reasonCode: ..., 
};

// Call the `adminRejectDonationClaimRef()` function to get a reference to the mutation.
const ref = adminRejectDonationClaimRef(adminRejectDonationClaimVars);
// Variables can be defined inline as well.
const ref = adminRejectDonationClaimRef({ id: ..., reasonCode: ..., });

// You can also pass in a `DataConnect` instance to the `MutationRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = adminRejectDonationClaimRef(dataConnect, adminRejectDonationClaimVars);

// Call `executeMutation()` on the reference to execute the mutation.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeMutation(ref);

console.log(data.donationClaim_update);
console.log(data.donationReviewEvent_insert);

// Or, you can use the `Promise` API.
executeMutation(ref).then((response) => {
  const data = response.data;
  console.log(data.donationClaim_update);
  console.log(data.donationReviewEvent_insert);
});
```

