# Generated TypeScript README
This README will guide you through the process of using the generated JavaScript SDK package for the connector `advertiser`. It will also provide examples on how to use your generated SDK to call your Data Connect queries and mutations.

***NOTE:** This README is generated alongside the generated SDK. If you make changes to this file, they will be overwritten when the SDK is regenerated.*

# Table of Contents
- [**Overview**](#generated-javascript-readme)
- [**Accessing the connector**](#accessing-the-connector)
  - [*Connecting to the local Emulator*](#connecting-to-the-local-emulator)
- [**Queries**](#queries)
  - [*AdvertiserListMyEligibleServers*](#advertiserlistmyeligibleservers)
  - [*AdvertiserListActivePackages*](#advertiserlistactivepackages)
  - [*AdvertiserListMyClaims*](#advertiserlistmyclaims)
- [**Mutations**](#mutations)

# Accessing the connector
A connector is a collection of Queries and Mutations. One SDK is generated for each connector - this SDK is generated for the connector `advertiser`. You can find more information about connectors in the [Data Connect documentation](https://firebase.google.com/docs/data-connect#how-does).

You can use this generated SDK by importing from the package `@mmorpg-top-100/advertiser-connector` as shown below. Both CommonJS and ESM imports are supported.

You can also follow the instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#set-client).

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@mmorpg-top-100/advertiser-connector';

const dataConnect = getDataConnect(connectorConfig);
```

## Connecting to the local Emulator
By default, the connector will connect to the production service.

To connect to the emulator, you can use the following code.
You can also follow the emulator instructions from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#instrument-clients).

```typescript
import { connectDataConnectEmulator, getDataConnect } from 'firebase/data-connect';
import { connectorConfig } from '@mmorpg-top-100/advertiser-connector';

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

Below are examples of how to use the `advertiser` connector's generated functions to execute each query. You can also follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-queries).

## AdvertiserListMyEligibleServers
You can execute the `AdvertiserListMyEligibleServers` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [advertiser/index.d.ts](./index.d.ts):
```typescript
advertiserListMyEligibleServers(vars: AdvertiserListMyEligibleServersVariables, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListMyEligibleServersData, AdvertiserListMyEligibleServersVariables>;

interface AdvertiserListMyEligibleServersRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdvertiserListMyEligibleServersVariables): QueryRef<AdvertiserListMyEligibleServersData, AdvertiserListMyEligibleServersVariables>;
}
export const advertiserListMyEligibleServersRef: AdvertiserListMyEligibleServersRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
advertiserListMyEligibleServers(dc: DataConnect, vars: AdvertiserListMyEligibleServersVariables, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListMyEligibleServersData, AdvertiserListMyEligibleServersVariables>;

interface AdvertiserListMyEligibleServersRef {
  ...
  (dc: DataConnect, vars: AdvertiserListMyEligibleServersVariables): QueryRef<AdvertiserListMyEligibleServersData, AdvertiserListMyEligibleServersVariables>;
}
export const advertiserListMyEligibleServersRef: AdvertiserListMyEligibleServersRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the advertiserListMyEligibleServersRef:
```typescript
const name = advertiserListMyEligibleServersRef.operationName;
console.log(name);
```

### Variables
The `AdvertiserListMyEligibleServers` query requires an argument of type `AdvertiserListMyEligibleServersVariables`, which is defined in [advertiser/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdvertiserListMyEligibleServersVariables {
  ownerUid: string;
}
```
### Return Type
Recall that executing the `AdvertiserListMyEligibleServers` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdvertiserListMyEligibleServersData`, which is defined in [advertiser/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdvertiserListMyEligibleServers`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, advertiserListMyEligibleServers, AdvertiserListMyEligibleServersVariables } from '@mmorpg-top-100/advertiser-connector';

// The `AdvertiserListMyEligibleServers` query requires an argument of type `AdvertiserListMyEligibleServersVariables`:
const advertiserListMyEligibleServersVars: AdvertiserListMyEligibleServersVariables = {
  ownerUid: ..., 
};

// Call the `advertiserListMyEligibleServers()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await advertiserListMyEligibleServers(advertiserListMyEligibleServersVars);
// Variables can be defined inline as well.
const { data } = await advertiserListMyEligibleServers({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await advertiserListMyEligibleServers(dataConnect, advertiserListMyEligibleServersVars);

console.log(data.servers);

// Or, you can use the `Promise` API.
advertiserListMyEligibleServers(advertiserListMyEligibleServersVars).then((response) => {
  const data = response.data;
  console.log(data.servers);
});
```

### Using `AdvertiserListMyEligibleServers`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, advertiserListMyEligibleServersRef, AdvertiserListMyEligibleServersVariables } from '@mmorpg-top-100/advertiser-connector';

// The `AdvertiserListMyEligibleServers` query requires an argument of type `AdvertiserListMyEligibleServersVariables`:
const advertiserListMyEligibleServersVars: AdvertiserListMyEligibleServersVariables = {
  ownerUid: ..., 
};

// Call the `advertiserListMyEligibleServersRef()` function to get a reference to the query.
const ref = advertiserListMyEligibleServersRef(advertiserListMyEligibleServersVars);
// Variables can be defined inline as well.
const ref = advertiserListMyEligibleServersRef({ ownerUid: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = advertiserListMyEligibleServersRef(dataConnect, advertiserListMyEligibleServersVars);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.servers);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.servers);
});
```

## AdvertiserListActivePackages
You can execute the `AdvertiserListActivePackages` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [advertiser/index.d.ts](./index.d.ts):
```typescript
advertiserListActivePackages(options?: ExecuteQueryOptions): QueryPromise<AdvertiserListActivePackagesData, undefined>;

interface AdvertiserListActivePackagesRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (): QueryRef<AdvertiserListActivePackagesData, undefined>;
}
export const advertiserListActivePackagesRef: AdvertiserListActivePackagesRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
advertiserListActivePackages(dc: DataConnect, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListActivePackagesData, undefined>;

interface AdvertiserListActivePackagesRef {
  ...
  (dc: DataConnect): QueryRef<AdvertiserListActivePackagesData, undefined>;
}
export const advertiserListActivePackagesRef: AdvertiserListActivePackagesRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the advertiserListActivePackagesRef:
```typescript
const name = advertiserListActivePackagesRef.operationName;
console.log(name);
```

### Variables
The `AdvertiserListActivePackages` query has no variables.
### Return Type
Recall that executing the `AdvertiserListActivePackages` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdvertiserListActivePackagesData`, which is defined in [advertiser/index.d.ts](./index.d.ts). It has the following fields:
```typescript
export interface AdvertiserListActivePackagesData {
  adPackages: ({
    code: string;
    durationDays: number;
    tier: string;
    priceMinor: Int64String;
    currency: string;
  } & AdPackage_Key)[];
}
```
### Using `AdvertiserListActivePackages`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, advertiserListActivePackages } from '@mmorpg-top-100/advertiser-connector';


// Call the `advertiserListActivePackages()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await advertiserListActivePackages();

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await advertiserListActivePackages(dataConnect);

console.log(data.adPackages);

// Or, you can use the `Promise` API.
advertiserListActivePackages().then((response) => {
  const data = response.data;
  console.log(data.adPackages);
});
```

### Using `AdvertiserListActivePackages`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, advertiserListActivePackagesRef } from '@mmorpg-top-100/advertiser-connector';


// Call the `advertiserListActivePackagesRef()` function to get a reference to the query.
const ref = advertiserListActivePackagesRef();

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = advertiserListActivePackagesRef(dataConnect);

// Call `executeQuery()` on the reference to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await executeQuery(ref);

console.log(data.adPackages);

// Or, you can use the `Promise` API.
executeQuery(ref).then((response) => {
  const data = response.data;
  console.log(data.adPackages);
});
```

## AdvertiserListMyClaims
You can execute the `AdvertiserListMyClaims` query using the following action shortcut function, or by calling `executeQuery()` after calling the following `QueryRef` function, both of which are defined in [advertiser/index.d.ts](./index.d.ts):
```typescript
advertiserListMyClaims(vars: AdvertiserListMyClaimsVariables, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListMyClaimsData, AdvertiserListMyClaimsVariables>;

interface AdvertiserListMyClaimsRef {
  ...
  /* Allow users to create refs without passing in DataConnect */
  (vars: AdvertiserListMyClaimsVariables): QueryRef<AdvertiserListMyClaimsData, AdvertiserListMyClaimsVariables>;
}
export const advertiserListMyClaimsRef: AdvertiserListMyClaimsRef;
```
You can also pass in a `DataConnect` instance to the action shortcut function or `QueryRef` function.
```typescript
advertiserListMyClaims(dc: DataConnect, vars: AdvertiserListMyClaimsVariables, options?: ExecuteQueryOptions): QueryPromise<AdvertiserListMyClaimsData, AdvertiserListMyClaimsVariables>;

interface AdvertiserListMyClaimsRef {
  ...
  (dc: DataConnect, vars: AdvertiserListMyClaimsVariables): QueryRef<AdvertiserListMyClaimsData, AdvertiserListMyClaimsVariables>;
}
export const advertiserListMyClaimsRef: AdvertiserListMyClaimsRef;
```

If you need the name of the operation without creating a ref, you can retrieve the operation name by calling the `operationName` property on the advertiserListMyClaimsRef:
```typescript
const name = advertiserListMyClaimsRef.operationName;
console.log(name);
```

### Variables
The `AdvertiserListMyClaims` query requires an argument of type `AdvertiserListMyClaimsVariables`, which is defined in [advertiser/index.d.ts](./index.d.ts). It has the following fields:

```typescript
export interface AdvertiserListMyClaimsVariables {
  advertiserUid: string;
}
```
### Return Type
Recall that executing the `AdvertiserListMyClaims` query returns a `QueryPromise` that resolves to an object with a `data` property.

The `data` property is an object of type `AdvertiserListMyClaimsData`, which is defined in [advertiser/index.d.ts](./index.d.ts). It has the following fields:
```typescript
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
```
### Using `AdvertiserListMyClaims`'s action shortcut function

```typescript
import { getDataConnect } from 'firebase/data-connect';
import { connectorConfig, advertiserListMyClaims, AdvertiserListMyClaimsVariables } from '@mmorpg-top-100/advertiser-connector';

// The `AdvertiserListMyClaims` query requires an argument of type `AdvertiserListMyClaimsVariables`:
const advertiserListMyClaimsVars: AdvertiserListMyClaimsVariables = {
  advertiserUid: ..., 
};

// Call the `advertiserListMyClaims()` function to execute the query.
// You can use the `await` keyword to wait for the promise to resolve.
const { data } = await advertiserListMyClaims(advertiserListMyClaimsVars);
// Variables can be defined inline as well.
const { data } = await advertiserListMyClaims({ advertiserUid: ..., });

// You can also pass in a `DataConnect` instance to the action shortcut function.
const dataConnect = getDataConnect(connectorConfig);
const { data } = await advertiserListMyClaims(dataConnect, advertiserListMyClaimsVars);

console.log(data.donationClaims);

// Or, you can use the `Promise` API.
advertiserListMyClaims(advertiserListMyClaimsVars).then((response) => {
  const data = response.data;
  console.log(data.donationClaims);
});
```

### Using `AdvertiserListMyClaims`'s `QueryRef` function

```typescript
import { getDataConnect, executeQuery } from 'firebase/data-connect';
import { connectorConfig, advertiserListMyClaimsRef, AdvertiserListMyClaimsVariables } from '@mmorpg-top-100/advertiser-connector';

// The `AdvertiserListMyClaims` query requires an argument of type `AdvertiserListMyClaimsVariables`:
const advertiserListMyClaimsVars: AdvertiserListMyClaimsVariables = {
  advertiserUid: ..., 
};

// Call the `advertiserListMyClaimsRef()` function to get a reference to the query.
const ref = advertiserListMyClaimsRef(advertiserListMyClaimsVars);
// Variables can be defined inline as well.
const ref = advertiserListMyClaimsRef({ advertiserUid: ..., });

// You can also pass in a `DataConnect` instance to the `QueryRef` function.
const dataConnect = getDataConnect(connectorConfig);
const ref = advertiserListMyClaimsRef(dataConnect, advertiserListMyClaimsVars);

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

No mutations were generated for the `advertiser` connector.

If you want to learn more about how to use mutations in Data Connect, you can follow the examples from the [Data Connect documentation](https://firebase.google.com/docs/data-connect/web-sdk#using-mutations).

