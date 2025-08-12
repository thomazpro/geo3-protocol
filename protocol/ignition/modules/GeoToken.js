const { buildModule } = require("@nomicfoundation/hardhat-ignition/modules");

module.exports = buildModule("GeoTokenModule", (m) => {
  const admin = m.getAccount(0);
  const cap = m.getParameter("cap", 1_000_000_000n * 10n ** 18n);

  const geoToken = m.contract("GeoToken", [admin, cap]);
  return { geoToken };
});
