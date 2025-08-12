const { expect } = require("chai");
const { ethers } = require("hardhat");

function buildGeoId(level, baseCell, digits = [], header = 0) {
  let id = BigInt(header) << 56n;
  id |= BigInt(level) << 8n;
  id |= BigInt(baseCell) << 12n;
  for (let i = 0; i < digits.length; i++) {
    id |= BigInt(digits[i]) << BigInt(19 + i * 3);
  }
  return id;
}

describe("GeoCellIDLib", function () {
  let lib;
  before(async () => {
    const Factory = await ethers.getContractFactory("MockGeoCellIDLib");
    lib = await Factory.deploy();
  });

  it("extracts level, base cell and digits", async () => {
    const geoId = buildGeoId(3, 42, [1, 2, 3]);
    expect(await lib.extractLevel(geoId)).to.equal(3);
    expect(await lib.extractBaseCell(geoId)).to.equal(42);
    expect(await lib.extractResolutionDigit(geoId, 2)).to.equal(2);
  });

  it("computes parent correctly", async () => {
    const geoId = buildGeoId(3, 42, [1, 2, 3]);
    const parent = await lib.parentOf(geoId);
    expect(parent).to.equal(buildGeoId(2, 42, [1, 2]));
  });

  it("checks ancestry relationships", async () => {
    const ancestor = buildGeoId(2, 42, [1, 2]);
    const descendant = buildGeoId(4, 42, [1, 2, 3, 4]);
    expect(await lib.isAncestorOf(ancestor, descendant)).to.equal(true);
    const notAncestor = buildGeoId(2, 42, [1, 3]);
    expect(await lib.isAncestorOf(notAncestor, descendant)).to.equal(false);
  });

  it("checks sibling relationship", async () => {
    const a = buildGeoId(3, 42, [1, 2, 3]);
    const b = buildGeoId(3, 42, [1, 2, 4]);
    expect(await lib.isSiblingOf(a, b)).to.equal(true);
    const c = buildGeoId(3, 42, [1, 3, 4]);
    expect(await lib.isSiblingOf(a, c)).to.equal(false);
  });

  it("checks same root", async () => {
    const a = buildGeoId(4, 42, [1, 2, 3, 4]);
    const b = buildGeoId(5, 42, [1, 2, 3, 9, 9]);
    expect(await lib.isSameRoot(a, b, 3)).to.equal(true);
    expect(await lib.isSameRoot(a, b, 4)).to.equal(false);
  });

  it("aggregates groups and validates level", async () => {
    const geoId = buildGeoId(4, 42, [1, 2, 3, 4]);
    expect(await lib.aggregationGroup(geoId, 2)).to.equal(buildGeoId(2, 42, [1, 2]));
    await expect(lib.aggregationGroup(geoId, 5)).to.be.revertedWithCustomError(lib, "InvalidAggregationTarget");
  });

  it("handles headers and masks", async () => {
    const geoId = buildGeoId(3, 42, [1, 2, 3], 0xaa);
    expect(await lib.extractHeader(geoId)).to.equal(0xaa);
    const cleared = await lib.clearHeader(geoId);
    expect(await lib.extractHeader(cleared)).to.equal(0);
    const masked = await lib.setHeader(cleared, 0x55);
    expect(await lib.matchesHeader(masked, 0xff00000000000000n, 0x5500000000000000n)).to.equal(true);
  });

  it("validates level boundaries", async () => {
    expect(await lib.isValidLevel(0)).to.equal(true);
    expect(await lib.isValidLevel(15)).to.equal(true);
    expect(await lib.isValidLevel(16)).to.equal(false);
    expect(await lib.isValidLevel(255)).to.equal(false);
  });

  it("reverts when digit index is out of range", async () => {
    const geoId = buildGeoId(3, 42, [1,2,3]);
    await expect(lib.extractResolutionDigit(geoId, 0)).to.be.revertedWithCustomError(lib, "InvalidDigit");
  });

  it("reverts when requesting parent of root level", async () => {
    const geoId = buildGeoId(0, 42, []);
    await expect(lib.parentOf(geoId)).to.be.revertedWithCustomError(lib, "RootLevelHasNoParent");
  });

  it("extracts cell and meta parts from uint128", async () => {
    const cell = buildGeoId(3, 42, [1, 2, 3], 0xaa);
    const meta = 0x1234567890abcdefn;
    const composite = (meta << 64n) | cell;
    expect(await lib.extractGeoCellPart(composite)).to.equal(cell);
    expect(await lib.extractMetaPart(composite)).to.equal(meta);
  });
});
