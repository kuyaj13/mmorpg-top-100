const { queryRef, executeQuery, validateArgsWithOptions, mutationRef, executeMutation, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'admin',
  service: 'mmorpg-top-100',
  location: 'asia-southeast1'
};
exports.connectorConfig = connectorConfig;

const adminListPendingSubmissionsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminListPendingSubmissions');
}
adminListPendingSubmissionsRef.operationName = 'AdminListPendingSubmissions';
exports.adminListPendingSubmissionsRef = adminListPendingSubmissionsRef;

exports.adminListPendingSubmissions = function adminListPendingSubmissions(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminListPendingSubmissionsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminApproveSubmissionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminApproveSubmission', inputVars);
}
adminApproveSubmissionRef.operationName = 'AdminApproveSubmission';
exports.adminApproveSubmissionRef = adminApproveSubmissionRef;

exports.adminApproveSubmission = function adminApproveSubmission(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminApproveSubmissionRef(dcInstance, inputVars));
}
;

const adminRejectSubmissionRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminRejectSubmission', inputVars);
}
adminRejectSubmissionRef.operationName = 'AdminRejectSubmission';
exports.adminRejectSubmissionRef = adminRejectSubmissionRef;

exports.adminRejectSubmission = function adminRejectSubmission(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminRejectSubmissionRef(dcInstance, inputVars));
}
;

const adminListPendingDonationClaimsRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdminListPendingDonationClaims');
}
adminListPendingDonationClaimsRef.operationName = 'AdminListPendingDonationClaims';
exports.adminListPendingDonationClaimsRef = adminListPendingDonationClaimsRef;

exports.adminListPendingDonationClaims = function adminListPendingDonationClaims(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(adminListPendingDonationClaimsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const adminVerifyDonationClaimRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminVerifyDonationClaim', inputVars);
}
adminVerifyDonationClaimRef.operationName = 'AdminVerifyDonationClaim';
exports.adminVerifyDonationClaimRef = adminVerifyDonationClaimRef;

exports.adminVerifyDonationClaim = function adminVerifyDonationClaim(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminVerifyDonationClaimRef(dcInstance, inputVars));
}
;

const adminRejectDonationClaimRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return mutationRef(dcInstance, 'AdminRejectDonationClaim', inputVars);
}
adminRejectDonationClaimRef.operationName = 'AdminRejectDonationClaim';
exports.adminRejectDonationClaimRef = adminRejectDonationClaimRef;

exports.adminRejectDonationClaim = function adminRejectDonationClaim(dcOrVars, vars) {
  const { dc: dcInstance, vars: inputVars } = validateArgs(connectorConfig, dcOrVars, vars, true);
  return executeMutation(adminRejectDonationClaimRef(dcInstance, inputVars));
}
;
