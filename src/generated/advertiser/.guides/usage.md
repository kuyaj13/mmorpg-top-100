# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { advertiserListMyEligibleServers, advertiserListActivePackages, advertiserListMyClaims } from '@mmorpg-top-100/advertiser-connector';


// Operation AdvertiserListMyEligibleServers:  For variables, look at type AdvertiserListMyEligibleServersVars in ../index.d.ts
const { data } = await AdvertiserListMyEligibleServers(dataConnect, advertiserListMyEligibleServersVars);

// Operation AdvertiserListActivePackages: 
const { data } = await AdvertiserListActivePackages(dataConnect);

// Operation AdvertiserListMyClaims:  For variables, look at type AdvertiserListMyClaimsVars in ../index.d.ts
const { data } = await AdvertiserListMyClaims(dataConnect, advertiserListMyClaimsVars);


```