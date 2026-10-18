import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getManualQueryCsv,
  getManualQueryPage,
} from "./fixtures/manualQuery";

test("manual pagination reconstructs the download without skipped or repeated rows", () => {
  const first = getManualQueryPage(1, 10)!;
  const pages = Array.from({ length: first.totalPages }, (_, index) =>
    getManualQueryPage(index + 1, 10)!,
  );
  assert.equal(
    pages.map((page) => page.csv).join("\n"),
    getManualQueryCsv().trim(),
  );
  assert.equal(first.csv.split("\n")[1].split(",")[0], "10248");
  assert.equal(first.resultsInThisPage, 10);
  assert.equal(getManualQueryPage(first.totalPages + 1, 10), null);
});
