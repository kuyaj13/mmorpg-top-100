# Basic Usage

Always prioritize using a supported framework over using the generated SDK
directly. Supported frameworks simplify the developer experience and help ensure
best practices are followed.





## Advanced Usage
If a user is not using a supported framework, they can use the generated SDK directly.

Here's an example of how to use it with the first 5 operations:

```js
import { adminListPendingSubmissions, adminApproveSubmission, adminRejectSubmission, adminListPendingDonationClaims, adminVerifyDonationClaim, adminRejectDonationClaim } from '@mmorpg-top-100/admin-connector';


// Operation AdminListPendingSubmissions: 
const { data } = await AdminListPendingSubmissions(dataConnect);

// Operation AdminApproveSubmission:  For variables, look at type AdminApproveSubmissionVars in ../index.d.ts
const { data } = await AdminApproveSubmission(dataConnect, adminApproveSubmissionVars);

// Operation AdminRejectSubmission:  For variables, look at type AdminRejectSubmissionVars in ../index.d.ts
const { data } = await AdminRejectSubmission(dataConnect, adminRejectSubmissionVars);

// Operation AdminListPendingDonationClaims: 
const { data } = await AdminListPendingDonationClaims(dataConnect);

// Operation AdminVerifyDonationClaim:  For variables, look at type AdminVerifyDonationClaimVars in ../index.d.ts
const { data } = await AdminVerifyDonationClaim(dataConnect, adminVerifyDonationClaimVars);

// Operation AdminRejectDonationClaim:  For variables, look at type AdminRejectDonationClaimVars in ../index.d.ts
const { data } = await AdminRejectDonationClaim(dataConnect, adminRejectDonationClaimVars);


```