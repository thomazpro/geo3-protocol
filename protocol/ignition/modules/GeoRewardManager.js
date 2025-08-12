const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const GeoTokenModule = require("./GeoToken");
const NodeDIDRegistryModule = require("./NodeDIDRegistry");

module.exports = buildModule("GeoRewardManagerModule", (m) => {
  const admin = m.getAccount(0);
  const oracle = m.getAccount(1);
  const { geoToken } = m.useModule(GeoTokenModule);
  const { nodeDIDRegistry } = m.useModule(NodeDIDRegistryModule);
  const epochWindow = m.getParameter("epochWindow", 168n);

  const geoRewardManager = m.contract("GeoRewardManager", [
    admin,
    oracle,
    geoToken,
    nodeDIDRegistry,
    epochWindow,
  ]);

  m.call(geoToken, "setRewardManager", [geoRewardManager]);

  return { geoRewardManager };
});
