const { queryRef, executeQuery, validateArgsWithOptions, validateArgs } = require('firebase/data-connect');

const connectorConfig = {
  connector: 'advertiser',
  service: 'mmorpg-top-100',
  location: 'asia-southeast1'
};
exports.connectorConfig = connectorConfig;

const advertiserListMyEligibleServersRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdvertiserListMyEligibleServers', inputVars);
}
advertiserListMyEligibleServersRef.operationName = 'AdvertiserListMyEligibleServers';
exports.advertiserListMyEligibleServersRef = advertiserListMyEligibleServersRef;

exports.advertiserListMyEligibleServers = function advertiserListMyEligibleServers(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(advertiserListMyEligibleServersRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const advertiserListActivePackagesRef = (dc) => {
  const { dc: dcInstance} = validateArgs(connectorConfig, dc, undefined);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdvertiserListActivePackages');
}
advertiserListActivePackagesRef.operationName = 'AdvertiserListActivePackages';
exports.advertiserListActivePackagesRef = advertiserListActivePackagesRef;

exports.advertiserListActivePackages = function advertiserListActivePackages(dcOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrOptions, options, undefined,false, false);
  return executeQuery(advertiserListActivePackagesRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;

const advertiserListMyClaimsRef = (dcOrVars, vars) => {
  const { dc: dcInstance, vars: inputVars} = validateArgs(connectorConfig, dcOrVars, vars, true);
  dcInstance._useGeneratedSdk();
  return queryRef(dcInstance, 'AdvertiserListMyClaims', inputVars);
}
advertiserListMyClaimsRef.operationName = 'AdvertiserListMyClaims';
exports.advertiserListMyClaimsRef = advertiserListMyClaimsRef;

exports.advertiserListMyClaims = function advertiserListMyClaims(dcOrVars, varsOrOptions, options) {
  
  const { dc: dcInstance, vars: inputVars, options: inputOpts } = validateArgsWithOptions(connectorConfig, dcOrVars, varsOrOptions, options, true, true);
  return executeQuery(advertiserListMyClaimsRef(dcInstance, inputVars), inputOpts && { fetchPolicy: inputOpts.fetchPolicy });
}
;
