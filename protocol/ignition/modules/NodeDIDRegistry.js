const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const GeoDataRegistryModule = require("./GeoDataRegistry");

module.exports = buildModule("NodeDIDRegistryModule", (m) => {
  const admin = m.getAccount(0);
  const { geoDataRegistry } = m.useModule(GeoDataRegistryModule);

  const nodeDIDRegistry = m.contract("NodeDIDRegistry", [
    admin,
    geoDataRegistry,
  ]);
  return { nodeDIDRegistry };
});
