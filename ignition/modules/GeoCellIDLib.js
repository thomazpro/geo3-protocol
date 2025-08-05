const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("GeoCellIDLibModule", (m) => {
  const geoCellIDLib = m.contract("GeoCellIDLib");
  return { geoCellIDLib };
});
