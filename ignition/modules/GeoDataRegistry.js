const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");
const GeoCellIDLibModule = require("./GeoCellIDLib");

module.exports = buildModule("GeoDataRegistryModule", (m) => {
  const admin = m.getAccount(0);
  const oracle = m.getAccount(1);
  const manager = m.getAccount(2);
  const epochMinInterval = m.getParameter("epochMinInterval", 3600n);

  const { geoCellIDLib } = m.useModule(GeoCellIDLibModule);

  const geoDataRegistry = m.contract(
    "GeoDataRegistry",
    [admin, oracle, manager, epochMinInterval],
    { libraries: { GeoCellIDLib: geoCellIDLib } }
  );

  return { geoDataRegistry };
});
