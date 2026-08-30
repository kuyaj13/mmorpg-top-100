import { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } from 'firebase/data-connect';

export const connectorConfig = {
  connector: 'admin',
  service: 'mmorpg-top-100',
  location: 'asia-southeast1'
};
export const adminListPendingSubmissionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminListPendingSubmissions');
}
adminListPendingSubmissionsRef.operationName = 'AdminListPendingSubmissions';

export function adminListPendingSubmissions(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminListPendingSubmissionsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const adminApproveSubmissionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminApproveSubmission', inputVars);
}
adminApproveSubmissionRef.operationName = 'AdminApproveSubmission';

export function adminApproveSubmission(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminApproveSubmissionRef(dcInstance, inputVars));
}

export const adminRejectSubmissionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminRejectSubmission', inputVars);
}
adminRejectSubmissionRef.operationName = 'AdminRejectSubmission';

export function adminRejectSubmission(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminRejectSubmissionRef(dcInstance, inputVars));
}

export const adminListPendingDonationClaimsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminListPendingDonationClaims');
}
adminListPendingDonationClaimsRef.operationName = 'AdminListPendingDonationClaims';

export function adminListPendingDonationClaims(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminListPendingDonationClaimsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}

export const adminVerifyDonationClaimRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminVerifyDonationClaim', inputVars);
}
adminVerifyDonationClaimRef.operationName = 'AdminVerifyDonationClaim';

export function adminVerifyDonationClaim(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminVerifyDonationClaimRef(dcInstance, inputVars));
}

export const adminRejectDonationClaimRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminRejectDonationClaim', inputVars);
}
adminRejectDonationClaimRef.operationName = 'AdminRejectDonationClaim';

export function adminRejectDonationClaim(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminRejectDonationClaimRef(dcInstance, inputVars));
}

